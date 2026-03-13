import { getConnection } from '@config/database.js';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2/promise';
import { buildLeaveViewQuery } from '@/modules/sync/repositories/sync-query-builders.repository.js';
import { normalizeLeaveRowWithMeta } from '@/modules/sync/services/domain/leave-normalizer.service.js';

const APPLY_FLAG = '--apply';
const OLD_TYPE_FLAG = '--old-type=';
const NEW_TYPE_FLAG = '--new-type=';

type Row = RowDataPacket & {
  ref_id: string;
  existing_leave_type: string | null;
};

const readArgValue = (prefix: string): string | null => {
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return null;
  const value = raw.slice(prefix.length).trim().toLowerCase();
  return value || null;
};

const run = async () => {
  const applyMode = process.argv.includes(APPLY_FLAG);
  const oldTypeFilter = readArgValue(OLD_TYPE_FLAG);
  const newTypeFilter = readArgValue(NEW_TYPE_FLAG);
  const conn = (await getConnection()) as PoolConnection;
  try {
    const [rows] = await conn.query<Row[]>(
      `
      SELECT lv.*, lr_current.leave_type AS existing_leave_type
      FROM (${buildLeaveViewQuery()}) lv
      LEFT JOIN leave_records lr_current
        ON CAST(lr_current.ref_id AS BINARY) = CAST(lv.ref_id AS BINARY)
      `,
    );

    const candidates: Array<{
      ref_id: string;
      old_leave_type: string;
      new_leave_type: string;
      reason_code: string | null;
    }> = [];

    for (const row of rows) {
      const oldType = String(row.existing_leave_type ?? '');
      if (!row.ref_id || !oldType) continue;
      const normalized = normalizeLeaveRowWithMeta(row as unknown as RowDataPacket);
      const newType = String(normalized.row.leave_type ?? '');
      if (!newType || newType === oldType) continue;
      if (oldTypeFilter && oldType.toLowerCase() !== oldTypeFilter) continue;
      if (newTypeFilter && newType.toLowerCase() !== newTypeFilter) continue;
      candidates.push({
        ref_id: String(row.ref_id),
        old_leave_type: oldType,
        new_leave_type: newType,
        reason_code: normalized.meta?.reason_code ?? null,
      });
    }

    const byPair = candidates.reduce<Record<string, number>>((acc, item) => {
      const key = `${item.old_leave_type} -> ${item.new_leave_type}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    console.log(`[backfill-leave-types] mode=${applyMode ? 'APPLY' : 'DRY_RUN'}`);
    console.log(`[backfill-leave-types] filters old=${oldTypeFilter ?? '-'} new=${newTypeFilter ?? '-'}`);
    console.log(`[backfill-leave-types] candidates=${candidates.length}`);
    console.log('[backfill-leave-types] by_pair=', byPair);
    console.table(candidates.slice(0, 40));

    if (!applyMode || candidates.length === 0) return;

    await conn.beginTransaction();
    let matchedRows = 0;
    for (const item of candidates) {
      const [result] = await conn.query<ResultSetHeader>(
        `
        UPDATE leave_records
        SET leave_type = ?,
            synced_at = NOW()
        WHERE CAST(ref_id AS BINARY) = CAST(? AS BINARY)
        `,
        [item.new_leave_type, item.ref_id],
      );
      matchedRows += Number(result.affectedRows ?? 0);
    }
    await conn.commit();
    console.log(`[backfill-leave-types] updated_rows=${matchedRows}`);
    if (matchedRows !== candidates.length) {
      console.warn(
        `[backfill-leave-types] warning: candidates=${candidates.length}, updated_rows=${matchedRows}`,
      );
    }
  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      console.error('[backfill-leave-types] rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    conn.release();
  }
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[backfill-leave-types] failed:', error);
    process.exit(1);
  });

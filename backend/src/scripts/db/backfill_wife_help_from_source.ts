import { getConnection } from '@config/database.js';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { buildLeaveViewQuery } from '@/modules/sync/repositories/sync-query-builders.repository.js';
import { normalizeLeaveRowWithMeta } from '@/modules/sync/services/domain/leave-normalizer.service.js';

type CandidateRow = RowDataPacket & {
  ref_id: string;
  citizen_id: string;
  hrms_leave_type: string | null;
  start_date: Date | string | null;
  end_date: Date | string | null;
  end_date_detail: string | null;
  half_day: number | null;
  remark: string | null;
  status: string | null;
  sex: string | null;
  source_type: string | null;
  duration_days: number | null;
  existing_leave_type: string | null;
};

const APPLY_FLAG = '--apply';

const run = async () => {
  const applyMode = process.argv.includes(APPLY_FLAG);
  const conn = (await getConnection()) as PoolConnection;

  try {
    const [rows] = await conn.query<CandidateRow[]>(
      `
      SELECT
        lv.*,
        lr_current.leave_type AS existing_leave_type
      FROM (${buildLeaveViewQuery()}) lv
      LEFT JOIN leave_records lr_current
        ON CAST(lr_current.ref_id AS BINARY) = CAST(lv.ref_id AS BINARY)
      `,
    );

    const candidates: Array<{
      ref_id: string;
      old_leave_type: string;
      new_leave_type: string;
      citizen_id: string;
      hrms_leave_type: string;
      remark: string;
    }> = [];

    for (const row of rows) {
      const normalized = normalizeLeaveRowWithMeta(row as unknown as RowDataPacket);
      const predicted = String(normalized.row.leave_type ?? '');
      const existing = String(row.existing_leave_type ?? '');
      if (!row.ref_id) continue;
      if (predicted !== 'wife_help') continue;
      if (!existing || existing === 'wife_help') continue;

      candidates.push({
        ref_id: String(row.ref_id),
        old_leave_type: existing,
        new_leave_type: 'wife_help',
        citizen_id: String(row.citizen_id ?? ''),
        hrms_leave_type: String(row.hrms_leave_type ?? ''),
        remark: String(row.remark ?? '').slice(0, 160),
      });
    }

    const byOldType = candidates.reduce<Record<string, number>>((acc, item) => {
      acc[item.old_leave_type] = (acc[item.old_leave_type] ?? 0) + 1;
      return acc;
    }, {});

    console.log(`[backfill-wife-help] mode=${applyMode ? 'APPLY' : 'DRY_RUN'}`);
    console.log(`[backfill-wife-help] candidates=${candidates.length}`);
    console.log('[backfill-wife-help] by_old_type=', byOldType);
    console.table(candidates.slice(0, 30));

    if (!applyMode || candidates.length === 0) return;

    const refIds = candidates.map((v) => v.ref_id);
    const marks = refIds.map(() => '?').join(', ');
    await conn.beginTransaction();
    const [result] = await conn.query<RowDataPacket[]>(
      `
      UPDATE leave_records
      SET leave_type = 'wife_help',
          synced_at = NOW()
      WHERE ref_id IN (${marks})
      `,
      refIds,
    );
    await conn.commit();

    const affected = Number((result as unknown as { affectedRows?: number }).affectedRows ?? 0);
    console.log(`[backfill-wife-help] updated_rows=${affected}`);
  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      console.error('[backfill-wife-help] rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    conn.release();
  }
};

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('[backfill-wife-help] failed:', error);
    process.exit(1);
  });

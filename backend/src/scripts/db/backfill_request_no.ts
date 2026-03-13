import { getConnection } from '@config/database.js';
import { generateRequestNoFromId } from '@/modules/request/services/helpers.js';
import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

const APPLY_FLAG = '--apply';
const MAX_GENERATE_RETRIES = 20;
const LEGACY_REQUEST_NO_PATTERN = /^REQ-\d{4}-\d+$/i;

type RequestRow = RowDataPacket & {
  request_id: number;
  request_no: string | null;
  created_at: string | Date | null;
};

const isBlank = (value: string | null | undefined): boolean => {
  if (typeof value !== 'string') return true;
  return value.trim().length === 0;
};

const shouldBackfill = (requestNo: string | null): boolean => {
  if (isBlank(requestNo)) return true;
  return LEGACY_REQUEST_NO_PATTERN.test(String(requestNo).trim());
};

const run = async () => {
  const applyMode = process.argv.includes(APPLY_FLAG);
  const conn = (await getConnection()) as PoolConnection;
  try {
    const [rows] = await conn.query<RequestRow[]>(
      `
      SELECT request_id, request_no, created_at
      FROM req_submissions
      ORDER BY request_id ASC
      `,
    );

    const candidates = rows.filter((row) => shouldBackfill(row.request_no));
    console.log(`[backfill-request-no] mode=${applyMode ? 'APPLY' : 'DRY_RUN'}`);
    console.log(`[backfill-request-no] candidates=${candidates.length}`);

    if (!candidates.length) return;

    const assignedInBatch = new Set<string>();
    const plans: Array<{
      request_id: number;
      old_request_no: string | null;
      new_request_no: string;
    }> = [];

    for (const row of candidates) {
      let nextRequestNo = '';
      for (let attempt = 0; attempt < MAX_GENERATE_RETRIES; attempt += 1) {
        const generated = generateRequestNoFromId(
          Number(row.request_id),
          row.created_at ?? new Date(),
        );
        if (assignedInBatch.has(generated)) continue;
        const [existsRows] = await conn.query<RowDataPacket[]>(
          `SELECT 1 AS found FROM req_submissions WHERE request_no = ? LIMIT 1`,
          [generated],
        );
        if (existsRows.length === 0) {
          nextRequestNo = generated;
          break;
        }
      }
      if (!nextRequestNo) {
        throw new Error(
          `ไม่สามารถสร้าง request_no ใหม่ได้ (request_id=${row.request_id})`,
        );
      }

      assignedInBatch.add(nextRequestNo);
      plans.push({
        request_id: Number(row.request_id),
        old_request_no: row.request_no ?? null,
        new_request_no: nextRequestNo,
      });
    }

    console.table(plans.slice(0, 50));

    if (!applyMode) return;

    await conn.beginTransaction();
    let affectedRows = 0;

    for (const plan of plans) {
      const [result] = await conn.query<ResultSetHeader>(
        `
        UPDATE req_submissions
        SET request_no = ?, updated_at = NOW()
        WHERE request_id = ?
        `,
        [plan.new_request_no, plan.request_id],
      );
      affectedRows += Number(result.affectedRows ?? 0);
    }

    await conn.commit();
    console.log(`[backfill-request-no] updated_rows=${affectedRows}`);
    if (affectedRows !== plans.length) {
      console.warn(
        `[backfill-request-no] warning: planned=${plans.length}, updated_rows=${affectedRows}`,
      );
    }
  } catch (error) {
    try {
      await conn.rollback();
    } catch (rollbackError) {
      console.error('[backfill-request-no] rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    conn.release();
  }
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[backfill-request-no] failed:', error);
    process.exit(1);
  });


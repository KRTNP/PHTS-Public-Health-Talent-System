import db, { closePool } from '@config/database.js';
import type { RowDataPacket } from 'mysql2/promise';

type SummaryRow = RowDataPacket & {
  total_rows: number;
  source_linked_rows: number;
  legacy_rows: number;
  legacy_resign_transfer_rows: number;
  legacy_non_manual_type_rows: number;
};

type TypeBreakdownRow = RowDataPacket & {
  movement_type: string;
  total_rows: number;
  oldest_effective_date: string | null;
  newest_effective_date: string | null;
};

type RecentCreatedRow = RowDataPacket & {
  created_date: string;
  total_rows: number;
};

type SampleRow = RowDataPacket & {
  movement_id: number;
  citizen_id: string;
  movement_type: string;
  effective_date: string;
  remark: string | null;
  created_at: string;
  synced_at: string | null;
};

async function main(): Promise<void> {
  const [[summary]] = await db.query<SummaryRow[]>(`
    SELECT
      COUNT(*) AS total_rows,
      SUM(CASE WHEN source_movement_id IS NOT NULL THEN 1 ELSE 0 END) AS source_linked_rows,
      SUM(CASE WHEN source_movement_id IS NULL THEN 1 ELSE 0 END) AS legacy_rows,
      SUM(CASE WHEN source_movement_id IS NULL AND movement_type IN ('RESIGN', 'TRANSFER_OUT') THEN 1 ELSE 0 END) AS legacy_resign_transfer_rows,
      SUM(CASE WHEN source_movement_id IS NULL AND movement_type NOT IN ('RESIGN', 'TRANSFER_OUT') THEN 1 ELSE 0 END) AS legacy_non_manual_type_rows
    FROM emp_movements
  `);

  const [typeBreakdown] = await db.query<TypeBreakdownRow[]>(`
    SELECT
      movement_type,
      COUNT(*) AS total_rows,
      MIN(DATE(effective_date)) AS oldest_effective_date,
      MAX(DATE(effective_date)) AS newest_effective_date
    FROM emp_movements
    WHERE source_movement_id IS NULL
    GROUP BY movement_type
    ORDER BY total_rows DESC, movement_type ASC
  `);

  const [recentCreated] = await db.query<RecentCreatedRow[]>(`
    SELECT
      DATE(created_at) AS created_date,
      COUNT(*) AS total_rows
    FROM emp_movements
    WHERE source_movement_id IS NULL
    GROUP BY DATE(created_at)
    ORDER BY created_date DESC
    LIMIT 10
  `);

  const [samples] = await db.query<SampleRow[]>(`
    SELECT
      movement_id,
      citizen_id,
      movement_type,
      DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date,
      remark,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
      DATE_FORMAT(synced_at, '%Y-%m-%d %H:%i:%s') AS synced_at
    FROM emp_movements
    WHERE source_movement_id IS NULL
    ORDER BY created_at DESC, movement_id DESC
    LIMIT 20
  `);

  console.log('[legacy-movements] summary');
  console.table([summary]);

  console.log('[legacy-movements] legacy breakdown by movement_type');
  console.table(typeBreakdown);

  console.log('[legacy-movements] recent legacy creation dates');
  console.table(recentCreated);

  console.log('[legacy-movements] latest sample rows');
  console.table(samples);
}

main()
  .catch((error) => {
    console.error('[legacy-movements] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

import { Pool } from 'mysql2/promise';
import path from 'path';
import { createTestPool, setupSchema, cleanTables, DB_NAME } from './utils.ts';
import type { BatchApproveResult } from '../request.types.js';

let pool: Pool;
let headFinanceId: number;
let approveBatch: (
  actorId: number,
  actorRole: string,
  params: { requestIds: number[]; comment?: string },
  // eslint-disable-next-line no-unused-vars
) => Promise<BatchApproveResult>;

beforeAll(async () => {
  process.env.DB_NAME = DB_NAME;
  pool = await createTestPool();
  await setupSchema(pool);
  await cleanTables(pool);

  // Load App (for any route-level dependencies)
  const appPath = path.join(process.cwd(), 'src/index.ts');
  const imported = await import(appPath);
  void imported.default;

  // Seed Data
  await pool.query(
    `INSERT INTO pts_master_rates (profession_code, group_no, amount) VALUES ('NURSE', 1, 1500)`,
  );

  const [userResult]: any = await pool.query(
    `INSERT INTO users (citizen_id, role) VALUES ('HEAD_FIN_CIT', 'HEAD_FINANCE')`,
  );
  headFinanceId = userResult.insertId;

  await pool.query(
    `INSERT INTO pts_user_signatures (user_id, signature_image) VALUES (?, 'mock_blob_data')`,
    [headFinanceId],
  );

  ({ approveBatch } = await import('../request.service.js'));
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('Request Workflow & Batch Approval', () => {
  test('Batch Approve isolates transactions per request', async () => {
    const [res1]: any = await pool.query(
      `
      INSERT INTO pts_requests (user_id, status, current_step, requested_amount, effective_date, applicant_signature_id)
      VALUES (1, 'PENDING', 5, 1500, '2024-01-01', 1)
    `,
    );
    const id1 = res1.insertId;

    const [res2]: any = await pool.query(
      `
      INSERT INTO pts_requests (user_id, status, current_step, requested_amount, effective_date, applicant_signature_id)
      VALUES (2, 'DRAFT', 1, 1500, '2024-01-01', 1)
    `,
    );
    const id2 = res2.insertId;

    const [res3]: any = await pool.query(
      `
      INSERT INTO pts_requests (user_id, status, current_step, requested_amount, effective_date, applicant_signature_id)
      VALUES (3, 'PENDING', 5, 1500, '2024-01-01', 1)
    `,
    );
    const id3 = res3.insertId;

    const result = await approveBatch(headFinanceId, 'HEAD_FINANCE', {
      requestIds: [id1, id2, id3],
      comment: 'Batch Test',
    });

    expect(result.success).toContain(id1);
    expect(result.success).toContain(id3);
    expect(result.failed.find((f) => f.id === id2)).toBeDefined();

    const [rows1]: any = await pool.query(
      `SELECT status, current_step FROM pts_requests WHERE request_id = ?`,
      [id1],
    );
    expect(rows1[0].current_step).toBe(6);

    const [rows2]: any = await pool.query(
      `SELECT status, current_step FROM pts_requests WHERE request_id = ?`,
      [id2],
    );
    expect(rows2[0].status).toBe('DRAFT');
    expect(rows2[0].current_step).toBe(1);

    const [rows3]: any = await pool.query(
      `SELECT status, current_step FROM pts_requests WHERE request_id = ?`,
      [id3],
    );
    expect(rows3[0].current_step).toBe(6);
  });
});

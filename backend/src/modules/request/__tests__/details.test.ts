import { Pool } from 'mysql2/promise';
import { createTestPool, setupSchema, cleanTables, DB_NAME } from './utils.ts';

let pool: Pool;
let getRequestDetails: (requestId: number) => Promise<any>;

async function insertUser(citizenId: string, role: string): Promise<number> {
  const [result]: any = await pool.query(
    `INSERT INTO users (citizen_id, role, password_hash) VALUES (?, ?, 'test-hash')`,
    [citizenId, role],
  );
  return result.insertId as number;
}

async function insertProfile(params: {
  citizenId: string;
  firstName?: string;
  lastName?: string;
  positionName?: string;
}) {
  await pool.query(
    `INSERT INTO emp_profiles (citizen_id, first_name, last_name, position_name)
     VALUES (?, ?, ?, ?)`,
    [
      params.citizenId,
      params.firstName ?? null,
      params.lastName ?? null,
      params.positionName ?? null,
    ],
  );
}

beforeAll(async () => {
  process.env.DB_NAME = DB_NAME;
  pool = await createTestPool();
  await setupSchema(pool);
  await cleanTables(pool);

  const service = await import('../request.service.js');
  getRequestDetails = service.getRequestDetails;
});

beforeEach(async () => {
  await cleanTables(pool);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('Request Details', () => {
  test('hydrates attachments and actions with actor data', async () => {
    const requesterId = await insertUser('REQ_DETAIL', 'USER');
    const actorId = await insertUser('APPROVER_1', 'HEAD_WARD');

    await insertProfile({
      citizenId: 'APPROVER_1',
      firstName: 'Somchai',
      lastName: 'Jaidee',
      positionName: 'หัวหน้าตึก',
    });

    const [reqResult]: any = await pool.query(
      `INSERT INTO req_submissions
       (user_id, citizen_id, request_no, request_type, status, current_step, requested_amount, effective_date)
       VALUES (?, ?, 'REQ-TEST-0001', 'NEW_ENTRY', 'PENDING', 1, 1500, '2024-01-01')`,
      [requesterId, 'REQ_DETAIL'],
    );
    const requestId = reqResult.insertId as number;

    const [attResult]: any = await pool.query(
      `INSERT INTO req_attachments (request_id, file_name, file_path, file_type)
       VALUES (?, 'license.pdf', '/tmp/license.pdf', 'LICENSE')`,
      [requestId],
    );
    const attachmentId = attResult.insertId as number;

    await pool.query(
      `INSERT INTO req_ocr_results
       (attachment_id, provider, status, confidence, processed_at)
       VALUES (?, 'TYPHOON', 'COMPLETED', 98.5, NOW())`,
      [attachmentId],
    );

    await pool.query(
      `INSERT INTO req_approvals
       (request_id, actor_id, step_no, action, comment, signature_snapshot)
       VALUES (?, ?, 1, 'APPROVE', 'ok', ?)`,
      [requestId, actorId, Buffer.from('sig')],
    );

    const details = await getRequestDetails(requestId);

    expect(details.attachments).toHaveLength(1);
    expect(details.attachments[0].file_name).toBe('license.pdf');
    expect(details.attachments[0].ocr_status).toBe('COMPLETED');
    expect(details.actions).toHaveLength(1);
    expect(details.actions[0].actor.citizen_id).toBe('APPROVER_1');
    expect(details.actions[0].actor.first_name).toBe('Somchai');
    expect(details.actions[0].actor.last_name).toBe('Jaidee');
  });
});

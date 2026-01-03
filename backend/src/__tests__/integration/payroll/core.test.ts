import request from 'supertest';
import path from 'path';
import { Pool } from 'mysql2/promise';
import { createTestPool, setupSchema, seedBaseData, cleanTables, signAdminToken } from './utils.js';

let pool: Pool;
let app: any;

beforeAll(async () => {
  pool = await createTestPool();
  await setupSchema(pool);
  await seedBaseData(pool);

  const appPath = path.join(process.cwd(), 'src/index.ts');
  const imported = await import(appPath);
  app = imported.default;
});

afterEach(async () => {
  await cleanTables(pool);
  await seedBaseData(pool);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('Payroll Integration: Core Scenarios', () => {
  const adminToken = signAdminToken();

  test('TC-PAY-01: Basic Calculation (Current Month)', async () => {
    const [rates]: any[] = await pool.query(
      `SELECT rate_id FROM pts_master_rates WHERE amount = 5000`,
    );
    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, is_active)
      VALUES ('DOC1', ?, '2024-01-01', 1)
    `,
      [rates[0].rate_id],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 1, citizen_id: 'DOC1' })
      .expect(200);

    const resultData = res.body.data[0];
    expect(resultData.netPayment).toBe(5000);
    expect(resultData.total_payable).toBe(5000);
  });

  test('TC-PAY-04: Mid-Month Entry (Pro-rated)', async () => {
    const cid = 'NEW_STAFF';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(
      `INSERT INTO pts_employees (citizen_id, position_name) VALUES (?, 'พนักงานทั่วไป')`,
      [cid],
    );

    await pool.query(`INSERT INTO pts_master_rates (amount) VALUES (31000)`);
    const [rate]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 31000`);

    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, is_active)
      VALUES (?, ?, '2024-01-01', 1)
    `,
      [cid, rate[0].rate_id],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_movements (citizen_id, movement_type, effective_date)
      VALUES (?, 'ENTRY', '2024-01-16')
    `,
      [cid],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status) 
      VALUES (?, '2024-01-01', '2030-12-31', 'ACTIVE')
    `,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 1, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(data.eligibleDays).toBe(16);
    expect(data.netPayment).toBe(16000);
  });

  test('TC-PAY-05: Swap Contract (Resign & Entry Same Day)', async () => {
    const cid = 'SWAP_USER';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);

    await pool.query(`INSERT INTO pts_master_rates (amount) VALUES (31000)`);
    const [rate]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 31000`);

    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, is_active)
      VALUES (?, ?, '2024-01-01', 1)
    `,
      [cid, rate[0].rate_id],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_movements (citizen_id, movement_type, effective_date) VALUES 
      (?, 'ENTRY', '2024-01-01'),
      (?, 'RESIGN', '2024-01-15'),
      (?, 'ENTRY', '2024-01-15')
    `,
      [cid, cid, cid],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status) 
      VALUES (?, '2024-01-01', '2030-12-31', 'ACTIVE')
    `,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 1, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(data.eligibleDays).toBe(31);
    expect(data.netPayment).toBe(31000);
  });
});

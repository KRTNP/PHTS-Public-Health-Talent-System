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

describe('Payroll Integration: Deductions & Leave', () => {
  const adminToken = signAdminToken();

  test('TC-PAY-06: Leave Deduction (Sick Leave > 60 days)', async () => {
    const cid = 'SICK_USER';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);

    const [existingRate]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 31000`);
    if (!existingRate || existingRate.length === 0) {
      await pool.query(`INSERT INTO pts_master_rates (amount) VALUES (31000)`);
    }
    const [rateNew]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 31000`);

    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, is_active)
      VALUES (?, ?, '2024-01-01', 1)
    `,
      [cid, rateNew[0].rate_id],
    );

    await pool.query(
      `
      INSERT INTO pts_leave_quotas (citizen_id, fiscal_year, quota_sick)
      VALUES (?, 2567, 0)
    `,
      [cid],
    );

    await pool.query(
      `
      INSERT INTO pts_leave_requests (citizen_id, leave_type, start_date, end_date, duration_days, fiscal_year)
      VALUES (?, 'sick', '2024-01-25', '2024-01-26', 2, 2567)
    `,
      [cid],
    );

    await pool.query(
      `INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 1, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(data.totalDeductionDays).toBe(2);
    expect(data.netPayment).toBe(29000);
  });

  test('TC-PAY-07: Study Leave (No Pay)', async () => {
    const cid = 'STUDY_DOC';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);

    const [rate]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 10000`);
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
      VALUES (?, 'STUDY', '2024-01-01')
    `,
      [cid],
    );

    await pool.query(
      `INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 1, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(data.netPayment).toBe(0);
    expect(data.remark).toMatch(/ลาศึกษาต่อ/);
  });

  test('TC-REAL-02: Long Term Training > 60 Days (Nurse Case)', async () => {
    const cid = 'NURSE_TRAIN';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);

    await pool.query(`INSERT INTO pts_master_rates (amount) VALUES (1500)`);
    const [rate]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 1500`);

    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, is_active)
      VALUES (?, ?, '2024-01-01', 1)
    `,
      [cid, rate[0].rate_id],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status) 
      VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')
    `,
      [cid],
    );

    await pool.query(
      `
      INSERT INTO pts_leave_requests (citizen_id, leave_type, start_date, end_date, duration_days, fiscal_year)
      VALUES (?, 'education', '2024-11-30', '2025-03-28', 119, 2568)
    `,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2025, month: 1, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];

    expect(data.eligibleDays).toBe(28);
    expect(data.totalDeductionDays).toBe(3);
    expect(data.netPayment).toBeCloseTo(1354.84);
  });
});

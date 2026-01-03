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

describe('Payroll Integration: Retroactive Scenarios', () => {
  const adminToken = signAdminToken();

  test('TC-PAY-02: Retroactive Logic (Fix Verification)', async () => {
    const [r5000]: any[] = await pool.query(
      `SELECT rate_id FROM pts_master_rates WHERE amount = 5000`,
    );
    const [r10000]: any[] = await pool.query(
      `SELECT rate_id FROM pts_master_rates WHERE amount = 10000`,
    );

    await pool.query(
      `INSERT INTO pts_periods (period_year, period_month, status) VALUES (2024, 1, 'CLOSED')`,
    );
    const [periodRes]: any = await pool.query(`SELECT period_id FROM pts_periods WHERE period_month = 1`);
    const periodIdJan = periodRes[0].period_id;

    await pool.query(
      `
      INSERT INTO pts_payouts (period_id, citizen_id, master_rate_id, pts_rate_snapshot, calculated_amount, total_payable)
      VALUES (?, 'DOC1', ?, 5000, 5000, 5000)
    `,
      [periodIdJan, r5000[0].rate_id],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, is_active)
      VALUES ('DOC1', ?, '2024-01-01', 1)
    `,
      [r10000[0].rate_id],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 2, citizen_id: 'DOC1' })
      .expect(200);

    const resultData = res.body.data[0];
    expect(resultData.netPayment).toBe(10000);
    expect(resultData.retroactiveTotal).toBe(5000);
    expect(resultData.total_payable).toBe(15000);
  });

  test('TC-PAY-08: Retroactive Deduction (Clawback/Overpayment)', async () => {
    const cid = 'CLAWBACK_USER';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);

    const [r5k]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 5000`);
    const [r10k]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 10000`);

    await pool.query(`INSERT INTO pts_periods (period_year, period_month, status) VALUES (2024, 1, 'CLOSED')`);
    const [periodRes]: any = await pool.query(
      `SELECT period_id FROM pts_periods WHERE period_month = 1 AND period_year = 2024`,
    );
    const periodIdJan = periodRes[0].period_id;

    await pool.query(
      `
      INSERT INTO pts_payouts (period_id, citizen_id, master_rate_id, pts_rate_snapshot, calculated_amount, total_payable)
      VALUES (?, ?, ?, 10000, 10000, 10000)
    `,
      [periodIdJan, cid, r10k[0].rate_id],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, is_active)
      VALUES (?, ?, '2024-01-01', 1)
    `,
      [cid, r5k[0].rate_id],
    );

    await pool.query(
      `INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 2, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(data.netPayment).toBe(5000);
    expect(data.retroactiveTotal).toBe(-5000);
    expect(data.total_payable).toBe(0);
  });

  test('TC-REAL-01: Split Month & Retroactive (Case Study: Doctor Split Periods)', async () => {
    const cid = 'DOC_SPLIT';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(
      `INSERT INTO pts_employees (citizen_id, position_name) VALUES (?, 'นายแพทย์ชำนาญการพิเศษ')`,
      [cid],
    );

    const [r10k]: any[] = await pool.query(
      `SELECT rate_id FROM pts_master_rates WHERE amount = 10000`,
    );
    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, is_active)
      VALUES (?, ?, '2024-01-01', 1)
    `,
      [cid, r10k[0].rate_id],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status, occupation_name) 
      VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE', 'นายแพทย์')
    `,
      [cid],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_movements (citizen_id, movement_type, effective_date) VALUES 
      (?, 'ENTRY', '2024-06-01'),
      (?, 'TRANSFER_OUT', '2024-06-07'),
      (?, 'ENTRY', '2024-08-25')
    `,
      [cid, cid, cid],
    );

    await pool.query(
      `INSERT INTO pts_periods (period_year, period_month, status) VALUES (2024, 6, 'CLOSED'), (2024, 7, 'CLOSED')`,
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 8, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];

    expect(data.netPayment).toBe(2258.06);
    expect(data.eligibleDays).toBe(7);
    expect(data.retroactiveTotal).toBe(2000.0);

    const retroJune = data.retroDetails.find((d: any) => d.month === 6);
    expect(retroJune).toBeDefined();
    expect(retroJune.diff).toBe(2000.0);

    expect(data.total_payable).toBe(4258.06);
  });

  test('TC-BRUTAL-01: The Double Retro Trap (Prevent Duplicate Payments)', async () => {
    const cid = 'DOUBLE_RETRO';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    const [r5k]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 5000`);
    const [r10k]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 10000`);

    await pool.query(`INSERT INTO pts_periods (period_year, period_month, status) VALUES (2024, 1, 'CLOSED')`);
    const [pJan]: any = await pool.query(`SELECT period_id FROM pts_periods WHERE period_month = 1`);
    await pool.query(
      `
      INSERT INTO pts_payouts (period_id, citizen_id, master_rate_id, pts_rate_snapshot, calculated_amount, total_payable)
      VALUES (?, ?, ?, 5000, 5000, 5000)
    `,
      [pJan[0].period_id, cid, r5k[0].rate_id],
    );

    await pool.query(`INSERT INTO pts_periods (period_year, period_month, status) VALUES (2024, 2, 'CLOSED')`);
    const [pFeb]: any = await pool.query(`SELECT period_id FROM pts_periods WHERE period_month = 2`);

    const [resFeb] = await pool.query<any>(
      `
      INSERT INTO pts_payouts (period_id, citizen_id, master_rate_id, pts_rate_snapshot, calculated_amount, total_payable, retroactive_amount)
      VALUES (?, ?, ?, 10000, 10000, 15000, 5000)
    `,
      [pFeb[0].period_id, cid, r10k[0].rate_id],
    );

    await pool.query(
      `
      INSERT INTO pts_payout_items (payout_id, reference_month, reference_year, item_type, amount)
      VALUES (?, 1, 2024, 'RETROACTIVE_ADD', 5000)
    `,
      [resFeb.insertId],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, is_active)
      VALUES (?, ?, '2024-01-01', 1)
    `,
      [cid, r10k[0].rate_id],
    );

    await pool.query(
      `INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 3, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(data.netPayment).toBe(10000);
    expect(data.retroactiveTotal).toBe(0);
  });
});

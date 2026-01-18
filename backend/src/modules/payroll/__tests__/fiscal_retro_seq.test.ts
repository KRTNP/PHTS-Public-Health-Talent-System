import request from 'supertest';
import path from 'path';
import { Pool } from 'mysql2/promise';
import {
  createTestPool,
  setupSchema,
  seedBaseData,
  cleanTables,
  resetTestData,
  signAdminToken,
} from './utils.js';

let pool: Pool;
let app: any;

beforeAll(async () => {
  pool = await createTestPool();
  await setupSchema(pool);
  await cleanTables(pool);
  await seedBaseData(pool);

  const appPath = path.join(process.cwd(), 'src/index.ts');
  const imported = await import(appPath);
  app = imported.default;
});

afterEach(async () => {
  await resetTestData(pool);
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('Payroll Integration: Advanced Edge Cases', () => {
  const adminToken = signAdminToken();

  test('TC-PAY-09: Fiscal Year Reset (Leave Quota Reset on Oct 1st)', async () => {
    const cid = 'FISCAL_USER';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(`INSERT INTO cfg_payment_rates (amount) VALUES (30000)`);
    const [rate]: any[] = await pool.query(`SELECT rate_id FROM cfg_payment_rates WHERE amount = 30000`);

    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active)
       VALUES (?, ?, '2023-01-01', 1)`,
      [cid, rate[0].rate_id],
    );
    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status)
       VALUES (?, '2023-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    // Quota 2567 consumed (0 left)
    await pool.query(
      `INSERT INTO leave_quotas (citizen_id, fiscal_year, quota_sick) VALUES (?, 2567, 0)`,
      [cid],
    );
    await pool.query(
      `INSERT INTO leave_records (citizen_id, leave_type, start_date, end_date, duration_days, fiscal_year)
       VALUES (?, 'sick', '2024-09-25', '2024-09-26', 2, 2567)`,
      [cid],
    );

    // New fiscal year quota (2568) refreshed
    await pool.query(
      `INSERT INTO leave_quotas (citizen_id, fiscal_year, quota_sick) VALUES (?, 2568, 60)`,
      [cid],
    );
    await pool.query(
      `INSERT INTO leave_records (citizen_id, leave_type, start_date, end_date, duration_days, fiscal_year)
       VALUES (?, 'sick', '2024-10-01', '2024-10-02', 2, 2568)`,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 10, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(data.totalDeductionDays).toBe(0);
    expect(data.netPayment).toBe(30000);
  });

  test('TC-BRUTAL-03: Sequential Retroactive (Adjust on Adjust)', async () => {
    const cid = 'SEQ_RETRO';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);

    const [r5k]: any[] = await pool.query(`SELECT rate_id FROM cfg_payment_rates WHERE amount = 5000`);
    const [r10k]: any[] = await pool.query(`SELECT rate_id FROM cfg_payment_rates WHERE amount = 10000`);
    let [r15k]: any[] = await pool.query(`SELECT rate_id FROM cfg_payment_rates WHERE amount = 15000`);
    if (!r15k || r15k.length === 0) {
      await pool.query(`INSERT INTO cfg_payment_rates (amount) VALUES (15000)`);
      [r15k] = await pool.query<any[]>(`SELECT rate_id FROM cfg_payment_rates WHERE amount = 15000`);
    }

    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status)
       VALUES (?, '2023-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    await pool.query(`INSERT INTO pay_periods (period_year, period_month, status) VALUES (2024, 1, 'CLOSED')`);
    const [pJan]: any = await pool.query(`SELECT period_id FROM pay_periods WHERE period_month = 1 AND period_year = 2024`);
    await pool.query(
      `INSERT INTO pay_results (period_id, citizen_id, master_rate_id, pts_rate_snapshot, calculated_amount, total_payable)
       VALUES (?, ?, ?, 5000, 5000, 5000)`,
      [pJan[0].period_id, cid, r5k[0].rate_id],
    );

    await pool.query(`INSERT INTO pay_periods (period_year, period_month, status) VALUES (2024, 2, 'CLOSED')`);
    const [pFeb]: any = await pool.query(`SELECT period_id FROM pay_periods WHERE period_month = 2 AND period_year = 2024`);
    const [resFeb] = await pool.query<any>(
      `INSERT INTO pay_results (period_id, citizen_id, master_rate_id, pts_rate_snapshot, calculated_amount, total_payable, retroactive_amount)
       VALUES (?, ?, ?, 10000, 10000, 15000, 5000)`,
      [pFeb[0].period_id, cid, r10k[0].rate_id],
    );
    await pool.query(
      `INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount)
       VALUES (?, 1, 2024, 'RETROACTIVE_ADD', 5000)`,
      [resFeb.insertId],
    );

    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active)
       VALUES (?, ?, '2024-01-01', 1)`,
      [cid, r15k[0].rate_id],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 3, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];

    expect(data.netPayment).toBe(15000);

    const retroJan = data.retroDetails.find((d: any) => d.month === 1);
    const retroFeb = data.retroDetails.find((d: any) => d.month === 2);

    expect(retroJan?.diff).toBe(5000);
    expect(retroFeb?.diff).toBe(5000);
    expect(data.retroactiveTotal).toBe(10000);
  });
});

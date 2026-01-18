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

describe('Payroll Integration: Advanced Complex Scenarios', () => {
  const adminToken = signAdminToken();

  test('TC-RETRO-01: Retroactive Upgrade (underpaid last month -> top up this month)', async () => {
    const cid = 'RETRO_UP';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);

    const [r10k]: any[] = await pool.query(`SELECT rate_id FROM cfg_payment_rates WHERE amount = 10000`);

    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active) VALUES (?, ?, '2024-07-01', 1)`,
      [cid, r10k[0].rate_id],
    );

    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    await pool.query(`INSERT INTO pay_periods (period_month, period_year, status) VALUES (7, 2024, 'CLOSED')`);
    const [periodJuly]: any[] = await pool.query(`SELECT period_id FROM pay_periods WHERE period_month=7`);

    await pool.query(
      `INSERT INTO pay_results (period_id, citizen_id, calculated_amount, total_payable) VALUES (?, ?, 5000, 5000)`,
      [periodJuly[0].period_id, cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 8, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(Number(data.netPayment)).toBe(10000);
    expect(Number(data.retroactiveTotal)).toBe(5000);
  });

  test('TC-RETRO-02: Clawback (overpaid last month -> deduct this month)', async () => {
    const cid = 'RETRO_DOWN';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    const [r10k]: any[] = await pool.query(`SELECT rate_id FROM cfg_payment_rates WHERE amount = 10000`);

    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active) VALUES (?, ?, '2024-07-01', 1)`,
      [cid, r10k[0].rate_id],
    );

    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2024-07-15', 'ACTIVE')`,
      [cid],
    );

    await pool.query(`INSERT INTO pay_periods (period_month, period_year, status) VALUES (7, 2024, 'CLOSED')`);
    const [periodJuly]: any[] = await pool.query(`SELECT period_id FROM pay_periods WHERE period_month=7`);
    await pool.query(
      `INSERT INTO pay_results (period_id, citizen_id, calculated_amount, total_payable) VALUES (?, ?, 10000, 10000)`,
      [periodJuly[0].period_id, cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 8, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(Number(data.netPayment)).toBe(0);
    expect(Number(data.retroactiveTotal)).toBeLessThan(0);
    expect(Number(data.retroactiveTotal)).toBeCloseTo(-5161.29, 0);
  });

  test('TC-MOV-03: Employment Swap (resign 15, re-entry 16 -> full month)', async () => {
    const cid = 'SWAP_USER';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    const [r5k]: any[] = await pool.query(`SELECT rate_id FROM cfg_payment_rates WHERE amount = 5000`);

    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active) VALUES (?, ?, '2024-01-01', 1)`,
      [cid, r5k[0].rate_id],
    );
    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    await pool.query(
      `INSERT INTO emp_movements (citizen_id, movement_type, effective_date) VALUES 
       (?, 'ENTRY', '2024-01-01'),
       (?, 'RESIGN', '2024-05-15'),
       (?, 'ENTRY', '2024-05-16')`,
      [cid, cid, cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 5, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(Number(data.eligibleDays)).toBe(31);
    expect(Number(data.netPayment)).toBe(5000);
  });

  test('TC-MOV-04: Service Gap (resign 10, re-entry 20 -> prorated)', async () => {
    const cid = 'GAP_USER';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    const [r5k]: any[] = await pool.query(`SELECT rate_id FROM cfg_payment_rates WHERE amount = 5000`);

    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active) VALUES (?, ?, '2024-01-01', 1)`,
      [cid, r5k[0].rate_id],
    );
    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    await pool.query(
      `INSERT INTO emp_movements (citizen_id, movement_type, effective_date) VALUES 
       (?, 'ENTRY', '2024-01-01'),
       (?, 'RESIGN', '2024-05-10'),
       (?, 'ENTRY', '2024-05-20')`,
      [cid, cid, cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 5, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(Number(data.eligibleDays)).toBe(21);
    expect(Number(data.netPayment)).toBeCloseTo(3387.10, 1);
  });
});

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

describe('Payroll Integration: Special Scenarios', () => {
  const adminToken = signAdminToken();

  test('TC-PAY-03: Lifetime License Check (Doctor)', async () => {
    const cid = 'DOC_LIFE';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(
      `INSERT INTO pts_employees (citizen_id, position_name) VALUES (?, 'นายแพทย์ชำนาญการ')`,
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
      INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status, license_name, occupation_name) 
      VALUES (?, '2010-01-01', '2020-01-01', 'EXPIRED', 'ใบประกอบวิชาชีพเวชกรรม (นายแพทย์)', 'นายแพทย์')
    `,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 3, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(data.netPayment).toBe(10000);
    expect(data.validLicenseDays).toBeGreaterThan(28);
  });

  test('TC-REAL-03: Mid-Month Promotion (Rate Change)', async () => {
    const cid = 'DOC_PROMO';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);

    const [r5k]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 5000`);
    const [r10k]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 10000`);

    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, expiry_date, is_active)
      VALUES (?, ?, '2024-01-01', '2024-09-15', 1)
    `,
      [cid, r5k[0].rate_id],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_eligibility (citizen_id, master_rate_id, effective_date, expiry_date, is_active)
      VALUES (?, ?, '2024-09-16', NULL, 1)
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

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 9, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];
    expect(data.eligibleDays).toBe(30);
    expect(data.netPayment).toBe(7500.0);
  });

  test('TC-BRUTAL-02: Leap Year 2024 & License Gap', async () => {
    const cid = 'LEAP_GAP';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(`INSERT INTO pts_master_rates (amount) VALUES (29000)`);
    const [rate]: any[] = await pool.query(`SELECT rate_id FROM pts_master_rates WHERE amount = 29000`);

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
      VALUES (?, '2024-01-01', '2024-02-14', 'ACTIVE')
    `,
      [cid],
    );

    await pool.query(
      `
      INSERT INTO pts_employee_licenses (citizen_id, valid_from, valid_until, status) 
      VALUES (?, '2024-02-20', '2024-12-31', 'ACTIVE')
    `,
      [cid],
    );

    const res = await request(app)
      .post('/api/payroll/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ year: 2024, month: 2, citizen_id: cid })
      .expect(200);

    const data = res.body.data[0];

    expect(data.eligibleDays).toBe(24);
    expect(data.netPayment).toBe(24000);
  });
});

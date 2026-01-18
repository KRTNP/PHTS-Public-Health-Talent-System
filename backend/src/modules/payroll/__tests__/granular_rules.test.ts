import { Pool } from 'mysql2/promise';
import {
  createTestPool,
  setupSchema,
  seedBaseData,
  cleanTables,
} from './utils.js';
import { calculateMonthly } from '../core/calculator.js';

let pool: Pool;
let baseRateId: number;

beforeAll(async () => {
  pool = await createTestPool();
  await setupSchema(pool);
  await cleanTables(pool);
  await seedBaseData(pool);
  const [rates]: any[] = await pool.query(
    `SELECT rate_id FROM cfg_payment_rates WHERE amount = 5000`,
  );
  baseRateId = rates[0].rate_id;
});

afterEach(async () => {
  const statements = [
    'SET FOREIGN_KEY_CHECKS = 0',
    'TRUNCATE TABLE pay_result_items',
    'TRUNCATE TABLE pay_results',
    'TRUNCATE TABLE pay_periods',
    'TRUNCATE TABLE req_eligibility',
    'TRUNCATE TABLE leave_records',
    'TRUNCATE TABLE leave_quotas',
    'TRUNCATE TABLE cfg_holidays',
    "DELETE FROM emp_licenses WHERE citizen_id NOT IN ('DOC1')",
    "DELETE FROM emp_profiles WHERE citizen_id NOT IN ('DOC1')",
    "DELETE FROM users WHERE citizen_id NOT IN ('ADMIN1','DOC1')",
    'SET FOREIGN_KEY_CHECKS = 1',
  ];
  await pool.query(statements.join('; '));
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe('Payroll Integration: Granular Rules & Edge Cases', () => {
  // แก้ไข: ใช้ปีงบประมาณ 2567 (สำหรับเดือน ก.ค. 2024)
  const FISCAL_YEAR = 2567;

  test('TC-LEV-07: Cross-Month Leave (ลาข้ามเดือน ต้องหักเฉพาะเดือนปัจจุบัน)', async () => {
    const cid = 'CROSS_MONTH';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active) VALUES (?, ?, '2024-01-01', 1)`,
      [cid, baseRateId],
    );
    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    // ลา 25 มิ.ย. - 5 ก.ค. (11 วัน) -> ในเดือน ก.ค. ควรเห็นแค่ 5 วัน (1-5 ก.ค.)
    await pool.query(
      `INSERT INTO leave_records (citizen_id, leave_type, start_date, end_date, duration_days, fiscal_year) 
       VALUES (?, 'personal', '2024-06-25', '2024-07-05', 11, ?)`,
      [cid, FISCAL_YEAR],
    );
    await pool.query(
      `INSERT INTO leave_quotas (citizen_id, fiscal_year, quota_personal) VALUES (?, ?, 0)`,
      [cid, FISCAL_YEAR],
    );

    const data = await calculateMonthly(cid, 2024, 7, pool as any);
    expect(Number(data.totalDeductionDays)).toBe(5);
  });

  test('TC-ADV-05: Weekend Gap Safety (ลาศุกร์และจันทร์ ไม่หักเสาร์อาทิตย์)', async () => {
    const cid = 'WEEKEND_GAP';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active) VALUES (?, ?, '2024-01-01', 1)`,
      [cid, baseRateId],
    );
    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    await pool.query(`INSERT INTO cfg_holidays (holiday_date) VALUES ('2024-07-06'), ('2024-07-07')`);

    await pool.query(
      `INSERT INTO leave_records (citizen_id, leave_type, start_date, end_date, duration_days, fiscal_year) VALUES 
       (?, 'sick', '2024-07-05', '2024-07-05', 1, ?),
       (?, 'sick', '2024-07-08', '2024-07-08', 1, ?)`,
      [cid, FISCAL_YEAR, cid, FISCAL_YEAR],
    );
    await pool.query(
      `INSERT INTO leave_quotas (citizen_id, fiscal_year, quota_sick) VALUES (?, ?, 0)`,
      [cid, FISCAL_YEAR],
    );

    const data = await calculateMonthly(cid, 2024, 7, pool as any);
    expect(Number(data.totalDeductionDays)).toBe(2);
  });

  test('TC-LIC-06: Overlapping Licenses (ใบประกอบทับซ้อน ต้องไม่นับวันเบิ้ล)', async () => {
    const cid = 'LIC_OVERLAP';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active) VALUES (?, ?, '2024-01-01', 1)`,
      [cid, baseRateId],
    );

    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES 
       (?, '2024-07-01', '2024-07-20', 'ACTIVE'),
       (?, '2024-07-10', '2024-07-31', 'ACTIVE')`,
      [cid, cid],
    );

    const data = await calculateMonthly(cid, 2024, 7, pool as any);
    expect(Number(data.validLicenseDays)).toBe(31);
  });

  // --- NEW TESTS (สิ่งที่ขาดจาก Demo) ---

  test('TC-LEV-06: Overlapping Leaves (ลาทับซ้อน ต้องไม่หักเงินซ้ำ)', async () => {
    const cid = 'LEAVE_OVERLAP';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active) VALUES (?, ?, '2024-01-01', 1)`,
      [cid, baseRateId],
    );
    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    await pool.query(
      `INSERT INTO leave_records (citizen_id, leave_type, start_date, end_date, duration_days, fiscal_year) VALUES 
       (?, 'sick', '2024-07-01', '2024-07-05', 5, ?),
       (?, 'personal', '2024-07-04', '2024-07-06', 3, ?)`,
      [cid, FISCAL_YEAR, cid, FISCAL_YEAR],
    );
    await pool.query(
      `INSERT INTO leave_quotas (citizen_id, fiscal_year, quota_sick, quota_personal) VALUES (?, ?, 0, 0)`,
      [cid, FISCAL_YEAR],
    );

    const data = await calculateMonthly(cid, 2024, 7, pool as any);
    expect(Number(data.totalDeductionDays)).toBe(5);
  });

  test('TC-LEV-08: Maternity Leave (ลาคลอด นับรวมวันหยุด)', async () => {
    const cid = 'MATERNITY';
    await pool.query(`INSERT INTO users (citizen_id, role) VALUES (?, 'USER')`, [cid]);
    await pool.query(
      `INSERT INTO req_eligibility (citizen_id, master_rate_id, effective_date, is_active) VALUES (?, ?, '2024-01-01', 1)`,
      [cid, baseRateId],
    );
    await pool.query(
      `INSERT INTO emp_licenses (citizen_id, valid_from, valid_until, status) VALUES (?, '2020-01-01', '2030-12-31', 'ACTIVE')`,
      [cid],
    );

    await pool.query(`INSERT INTO cfg_holidays (holiday_date) VALUES ('2024-07-06'), ('2024-07-07')`);

    await pool.query(
      `INSERT INTO leave_records (citizen_id, leave_type, start_date, end_date, duration_days, fiscal_year) 
       VALUES (?, 'maternity', '2024-07-05', '2024-07-09', 5, ?)`,
      [cid, FISCAL_YEAR],
    );

    const data = await calculateMonthly(cid, 2024, 7, pool as any);
    expect(Number(data.totalDeductionDays)).toBe(0);
    expect(Number(data.netPayment)).toBe(5000);
  });
});

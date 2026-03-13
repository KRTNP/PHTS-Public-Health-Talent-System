import { FinanceRepository } from '@/modules/finance/repositories/finance.repository.js';
import { PaymentStatus } from '@/modules/finance/entities/finance.entity.js';
import {
  resetFinanceSchema,
  getTestConnection,
} from '@/test/test-db.js';

jest.setTimeout(30000);

describe("FinanceRepository (integration)", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    await resetFinanceSchema();
  });

  beforeEach(async () => {
    const conn = await getTestConnection();
    try {
      await conn.execute("DELETE FROM pay_results");
      await conn.execute("DELETE FROM pay_periods");
      await conn.execute("DELETE FROM emp_profiles");
      await conn.execute("DELETE FROM emp_support_staff");
    } finally {
      await conn.end();
    }
  });

  test("findPayoutById and updatePayoutStatus", async () => {
    const conn = await getTestConnection();
    let payoutId: number;
    try {
      const [periodRes] = await conn.execute<any>(
        `INSERT INTO pay_periods (period_month, period_year, status)
         VALUES (2, 2026, 'OPEN')`,
      );
      const periodId = Number(periodRes.insertId);
      const [payoutRes] = await conn.execute<any>(
        `INSERT INTO pay_results
         (period_id, citizen_id, total_payable, payment_status)
         VALUES (?, '800', 1000, 'PENDING')`,
        [periodId],
      );
      payoutId = Number(payoutRes.insertId);
    } finally {
      await conn.end();
    }

    const initial = await FinanceRepository.findPayoutById(payoutId);
    expect(initial?.payment_status).toBe("PENDING");

    const conn2 = await FinanceRepository.getConnection();
    try {
      await FinanceRepository.updatePayoutStatus(
        payoutId,
        PaymentStatus.PAID,
        1,
        conn2,
      );
    } finally {
      conn2.release();
    }

    const updated = await FinanceRepository.findPayoutById(payoutId);
    expect(updated?.payment_status).toBe("PAID");
  });

  test("findPayoutsByPeriod returns mapped rows", async () => {
    const conn = await getTestConnection();
    let periodId: number;
    try {
      const [periodRes] = await conn.execute<any>(
        `INSERT INTO pay_periods (period_month, period_year, status)
         VALUES (2, 2026, 'OPEN')`,
      );
      periodId = Number(periodRes.insertId);
      await conn.execute(
        `INSERT INTO emp_profiles
         (citizen_id, first_name, last_name, department)
         VALUES ('900', 'A', 'B', 'D1')`,
      );
      await conn.execute(
        `INSERT INTO pay_results
         (period_id, citizen_id, pts_rate_snapshot, calculated_amount, retroactive_amount, total_payable, payment_status)
         VALUES (?, '900', 1000, 900, 0, 900, 'PENDING')`,
        [periodId],
      );
    } finally {
      await conn.end();
    }

    const rows = await FinanceRepository.findPayoutsByPeriod(periodId);
    expect(rows.length).toBe(1);
    expect(rows[0].employee_name).toBe("A B");
  });

  test("findFinanceSummary and findYearlySummary return aggregated totals", async () => {
    const conn = await getTestConnection();
    try {
      const [periodRes] = await conn.execute<any>(
        `INSERT INTO pay_periods (period_month, period_year, status, snapshot_status)
         VALUES (2, 2026, 'CLOSED', 'READY')`,
      );
      const periodId = Number(periodRes.insertId);

      await conn.execute(
        `INSERT INTO pay_results
         (period_id, citizen_id, total_payable, payment_status)
         VALUES (?, '1001', 1000, 'PENDING')`,
        [periodId],
      );
      await conn.execute(
        `INSERT INTO pay_results
         (period_id, citizen_id, total_payable, payment_status)
         VALUES (?, '1002', 500, 'PAID')`,
        [periodId],
      );
    } finally {
      await conn.end();
    }

    const summary = await FinanceRepository.findFinanceSummary(2026);
    expect(summary.length).toBe(1);
    expect(Number(summary[0].total_employees)).toBe(2);
    expect(Number(summary[0].total_amount)).toBe(1500);
    expect(Number(summary[0].paid_amount)).toBe(500);
    expect(Number(summary[0].pending_amount)).toBe(1000);

    const yearly = await FinanceRepository.findYearlySummary(2026);
    expect(yearly.length).toBe(1);
    expect(Number(yearly[0].total_employees)).toBe(2);
    expect(Number(yearly[0].total_amount)).toBe(1500);
    expect(Number(yearly[0].paid_amount)).toBe(500);
    expect(Number(yearly[0].pending_amount)).toBe(1000);
  });

  test("findPayoutsByPeriod supports filtering by profession and group", async () => {
    const conn = await getTestConnection();
    let periodId: number;
    let nurseGroup1RateId: number;
    let doctorGroup2RateId: number;
    try {
      const [periodRes] = await conn.execute<any>(
        `INSERT INTO pay_periods (period_month, period_year, status)
         VALUES (2, 2026, 'OPEN')`,
      );
      periodId = Number(periodRes.insertId);

      const [rate1Res] = await conn.execute<any>(
        `INSERT INTO cfg_payment_rates (amount, group_no, item_no, profession_code)
         VALUES (5000, 1, '1', 'NURSE')`,
      );
      nurseGroup1RateId = Number(rate1Res.insertId);

      const [rate2Res] = await conn.execute<any>(
        `INSERT INTO cfg_payment_rates (amount, group_no, item_no, profession_code)
         VALUES (7000, 2, '1', 'DOCTOR')`,
      );
      doctorGroup2RateId = Number(rate2Res.insertId);

      await conn.execute(
        `INSERT INTO emp_profiles (citizen_id, first_name, last_name, department)
         VALUES ('910', 'Nurse', 'One', 'Ward')`,
      );
      await conn.execute(
        `INSERT INTO emp_profiles (citizen_id, first_name, last_name, department)
         VALUES ('920', 'Doctor', 'Two', 'ER')`,
      );

      await conn.execute(
        `INSERT INTO pay_results
         (period_id, citizen_id, master_rate_id, profession_code, pts_rate_snapshot, calculated_amount, retroactive_amount, total_payable, payment_status)
         VALUES (?, '910', ?, 'NURSE', 5000, 5000, 0, 5000, 'PENDING')`,
        [periodId, nurseGroup1RateId],
      );
      await conn.execute(
        `INSERT INTO pay_results
         (period_id, citizen_id, master_rate_id, profession_code, pts_rate_snapshot, calculated_amount, retroactive_amount, total_payable, payment_status)
         VALUES (?, '920', ?, 'DOCTOR', 7000, 7000, 0, 7000, 'PENDING')`,
        [periodId, doctorGroup2RateId],
      );
    } finally {
      await conn.end();
    }

    const byProfession = await FinanceRepository.findPayoutsByPeriod(
      periodId,
      undefined,
      undefined,
      "NURSE",
    );
    expect(byProfession.length).toBe(1);
    expect(byProfession[0].profession_code).toBe("NURSE");

    const byGroup = await FinanceRepository.findPayoutsByPeriod(
      periodId,
      undefined,
      undefined,
      undefined,
      2,
    );
    expect(byGroup.length).toBe(1);
    expect(byGroup[0].group_no).toBe(2);

    const byBoth = await FinanceRepository.findPayoutsByPeriod(
      periodId,
      undefined,
      undefined,
      "NURSE",
      1,
    );
    expect(byBoth.length).toBe(1);
    expect(byBoth[0].profession_code).toBe("NURSE");
    expect(byBoth[0].group_no).toBe(1);
  });
});

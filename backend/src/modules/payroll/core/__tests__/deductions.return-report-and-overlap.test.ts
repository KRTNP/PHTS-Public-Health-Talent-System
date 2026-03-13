import {
  calculateDeductions,
  LeaveRow,
  QuotaDecision,
} from '@/modules/payroll/core/deductions/deductions.js';

describe('payroll core deductions (return report and overlap)', () => {
  const monthStart = new Date('2026-02-01');
  const monthEnd = new Date('2026-02-28');
  test("education leave is shortened by return report date", () => {
    const leaves: LeaveRow[] = [
      {
        id: 205,
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        duration_days: 28,
      },
    ];
    const returnReports = new Map<number, Date>([
      [205, new Date("2026-02-10")], // deduct until 2026-02-09
    ]);

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[205, { overQuota: true, exceedDate: new Date("2026-02-01") }]]),
      [],
      returnReports,
    );

    expect(map.get("2026-02-09")).toBe(1);
    expect(map.get("2026-02-10")).toBeUndefined();
    expect(map.size).toBe(9);
  });

  test("ordain leave is shortened by return report date", () => {
    const leaves: LeaveRow[] = [
      {
        id: 207,
        leave_type: "ordain",
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        duration_days: 28,
      },
    ];
    const returnReports = new Map<number, Date>([
      [207, new Date("2026-02-10")], // deduct until 2026-02-09
    ]);

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[207, { overQuota: true, exceedDate: new Date("2026-02-01") }]]),
      [],
      returnReports,
    );

    expect(map.get("2026-02-09")).toBe(1);
    expect(map.get("2026-02-10")).toBeUndefined();
    expect(map.size).toBe(9);
  });

  test("military leave is shortened by return report date", () => {
    const leaves: LeaveRow[] = [
      {
        id: 208,
        leave_type: "military",
        start_date: "2026-02-01",
        end_date: "2026-02-28",
        duration_days: 28,
      },
    ];
    const returnReports = new Map<number, Date>([
      [208, new Date("2026-02-10")], // deduct until 2026-02-09
    ]);

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[208, { overQuota: true, exceedDate: new Date("2026-02-01") }]]),
      [],
      returnReports,
    );

    expect(map.get("2026-02-09")).toBe(1);
    expect(map.get("2026-02-10")).toBeUndefined();
    expect(map.size).toBe(9);
  });

  test("education without return report does not extend deduction to month end", () => {
    const leaves: LeaveRow[] = [
      {
        id: 209,
        leave_type: "education",
        start_date: "2026-02-01",
        end_date: "2026-02-10",
        duration_days: 10,
      },
    ];

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[209, { overQuota: true, exceedDate: new Date("2026-02-01") }]]),
      [],
      new Map(),
    );

    expect(map.get("2026-02-10")).toBe(1);
    expect(map.get("2026-02-11")).toBeUndefined();
    expect(map.size).toBe(10);
  });

  test("ignores unknown leave type without throwing", () => {
    const leaves: LeaveRow[] = [
      {
        id: 206,
        leave_type: "special_unknown",
        start_date: "2026-02-05",
        end_date: "2026-02-06",
        duration_days: 2,
      },
    ];

    const { deductionMap: map } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map<number, QuotaDecision>(),
      [],
      new Map(),
    );

    expect(map.size).toBe(0);
  });

  test("caps same-day overlap between over-quota half-day and no-pay at 1 with reasons", () => {
    const targetDate = "2026-02-13"; // Friday
    const leaves: LeaveRow[] = [
      {
        id: 300,
        leave_type: "sick",
        start_date: targetDate,
        end_date: targetDate,
        duration_days: 1,
        document_duration_days: 0.5,
      },
      {
        leave_type: "personal",
        start_date: targetDate,
        end_date: targetDate,
        duration_days: 1,
        is_no_pay: 1,
      },
    ];

    const { deductionMap: map, reasonsByDate } = calculateDeductions(
      leaves,
      [],
      monthStart,
      monthEnd,
      new Map([[300, { overQuota: true, exceedDate: new Date(targetDate) }]]),
      [],
      new Map(),
    );

    const reasons = reasonsByDate.get(targetDate) ?? [];
    const totalReasonWeight = reasons.reduce((sum, r) => sum + r.weight, 0);

    expect(map.get(targetDate)).toBe(1);
    expect(totalReasonWeight).toBe(1);
    expect(reasons.some((r) => r.code === "OVER_QUOTA")).toBe(true);
    expect(reasons.some((r) => r.code === "NO_PAY")).toBe(true);
  });
});

import { buildPayrollLeaveImpactSummary } from "@/modules/payroll/services/calculation/payroll-leave-impact.service.js";

describe("buildPayrollLeaveImpactSummary", () => {
  test("summarizes leaves in period, quota usage, and deducted amounts", () => {
    const summary = buildPayrollLeaveImpactSummary({
      year: 2026,
      month: 2,
      baseRate: 2800,
      leaveRows: [
        {
          id: 11,
          citizen_id: "1111111111111",
          leave_type: "personal",
          start_date: "2026-01-29",
          end_date: "2026-02-03",
          duration_days: 4,
          is_no_pay: 0,
          pay_exception: 0,
        },
        {
          id: 12,
          citizen_id: "1111111111111",
          leave_type: "personal",
          start_date: "2026-02-10",
          end_date: "2026-02-13",
          duration_days: 4,
          is_no_pay: 0,
          pay_exception: 0,
        },
        {
          id: 13,
          citizen_id: "1111111111111",
          leave_type: "education",
          start_date: "2026-02-20",
          end_date: "2026-02-21",
          duration_days: 2,
          is_no_pay: 1,
          pay_exception: 0,
          study_institution: "มหาวิทยาลัยเชียงใหม่",
          study_program: "การพยาบาลเฉพาะทาง",
          study_major: "ผู้ป่วยวิกฤต",
          return_report_status: "PENDING",
        },
      ],
      quotaRow: {
        quota_personal: 5,
        quota_education: 60,
      },
      holidays: [],
      noSalaryRows: [],
      returnReportRows: [],
    });

    expect(summary.deductedDays).toBe(5);
    expect(summary.deductedAmount).toBe(500);

    expect(summary.quotaByType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leaveType: "personal",
          quotaLimit: 5,
          usedBeforePeriod: 2,
          usedInPeriod: 6,
          remainingBeforePeriod: 3,
          remainingAfterPeriod: 0,
          overQuota: true,
          exceedDate: "2026-02-11",
        }),
      ]),
    );

    expect(summary.leavesInPeriod).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leaveRecordId: 11,
          leaveType: "personal",
          overlapStartDate: "2026-02-01",
          overlapEndDate: "2026-02-03",
          daysInPeriod: 2,
          deductedDays: 0,
          deductedAmount: 0,
          overQuota: false,
        }),
        expect.objectContaining({
          leaveRecordId: 12,
          leaveType: "personal",
          overlapStartDate: "2026-02-10",
          overlapEndDate: "2026-02-13",
          daysInPeriod: 4,
          deductedDays: 3,
          deductedAmount: 300,
          overQuota: true,
          exceedDate: "2026-02-11",
        }),
        expect.objectContaining({
          leaveRecordId: 13,
          leaveType: "education",
          overlapStartDate: "2026-02-20",
          overlapEndDate: "2026-02-21",
          deductedDays: 2,
          deductedAmount: 200,
          isNoPay: true,
          returnReportStatus: "PENDING",
          studyInstitution: "มหาวิทยาลัยเชียงใหม่",
          studyProgram: "การพยาบาลเฉพาะทาง",
          studyMajor: "ผู้ป่วยวิกฤต",
        }),
      ]),
    );
  });

  test("includes synthetic study leaves from movement rows without missing quota decisions", () => {
    const summary = buildPayrollLeaveImpactSummary({
      year: 2026,
      month: 1,
      baseRate: 1500,
      leaveRows: [],
      quotaRow: {
        quota_education: 60,
      },
      holidays: [],
      movementRows: [
        {
          movement_id: 1,
          movement_type: "STUDY",
          effective_date: "2026-01-10",
        },
        {
          movement_id: 2,
          movement_type: "TRANSFER_OUT",
          effective_date: "2026-01-20",
        },
      ] as any[],
      noSalaryRows: [],
      returnReportRows: [],
    });

    expect(summary.deductedDays).toBe(0);
    expect(summary.leavesInPeriod).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          leaveRecordId: -1,
          leaveType: "education",
          overlapStartDate: "2026-01-10",
          overlapEndDate: "2026-01-19",
          overQuota: false,
        }),
      ]),
    );
  });
});

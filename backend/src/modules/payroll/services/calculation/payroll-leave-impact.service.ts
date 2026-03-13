import {
  calculateDeductions,
  type DeductionReason,
  type LeaveRow,
  type ReturnReportRow,
  type NoSalaryPeriodRow,
  type QuotaDecision,
  type QuotaRow,
} from "@/modules/payroll/core/deductions/deductions.js";
import type { MovementRow } from "@/modules/payroll/core/calculator/facade/calculator.js";
import {
  assignSyntheticIdsToLeaves,
  buildStudyLeaveRowsFromMovements,
} from "@/modules/payroll/core/calculator/facade/calculator.work-period.js";
import {
  formatLocalDate,
  makeLocalDate,
  countBusinessDays,
  countCalendarDays,
  isHoliday,
} from "@/modules/payroll/core/utils/date.utils.js";
import { LEAVE_RULES, type LeaveRuleType, type LeaveUnit } from "@/modules/payroll/payroll.constants.js";
import {
  calculateLeaveQuotaStatus,
  type LeavePolicyInputRow,
} from "@/modules/leave-management/services/leave-domain.service.js";

export type PayrollLeaveImpactLeave = {
  leaveRecordId: number | null;
  leaveType: string;
  startDate: string;
  endDate: string;
  overlapStartDate: string;
  overlapEndDate: string;
  daysInPeriod: number;
  deductedDays: number;
  deductedAmount: number;
  isNoPay: boolean;
  overQuota: boolean;
  exceedDate: string | null;
  returnReportStatus: string | null;
  studyInstitution: string | null;
  studyProgram: string | null;
  studyMajor: string | null;
};

export type PayrollLeaveImpactQuota = {
  leaveType: string;
  quotaLimit: number | null;
  ruleType: LeaveRuleType;
  tracksBalance: boolean;
  quotaUnit: LeaveUnit | null;
  usedBeforePeriod: number;
  usedInPeriod: number;
  remainingBeforePeriod: number | null;
  remainingAfterPeriod: number | null;
  overQuota: boolean;
  exceedDate: string | null;
};

export type PayrollLeaveImpactSummary = {
  deductedDays: number;
  deductedAmount: number;
  leavesInPeriod: PayrollLeaveImpactLeave[];
  quotaByType: PayrollLeaveImpactQuota[];
};

type BuildPayrollLeaveImpactSummaryInput = {
  year: number;
  month: number;
  baseRate: number;
  leaveRows: LeavePolicyInputRow[];
  quotaRow: QuotaRow | null;
  holidays: string[];
  movementRows?: MovementRow[];
  noSalaryRows?: NoSalaryPeriodRow[];
  returnReportRows?: ReturnReportRow[];
};

type LeaveImpactInputRow = LeavePolicyInputRow & {
  return_report_status?: string | null;
};

const parseLocalDateString = (value: string): Date => {
  const [yy, mm, dd] = value.split("-").map((part) => Number(part));
  return makeLocalDate(yy, (mm ?? 1) - 1, dd ?? 1);
};

const toDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const resolveEffectiveDate = (
  primary: string | Date | null | undefined,
  fallback: string | Date,
): Date => toDate(primary) ?? new Date(fallback);

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const calculateOverlapDuration = (
  leave: LeavePolicyInputRow,
  start: Date,
  end: Date,
  holidays: string[],
): number => {
  const durationOverride = leave.document_duration_days ?? leave.duration_days ?? null;
  if (durationOverride !== null && durationOverride > 0 && durationOverride < 1) {
    const dateStr = formatLocalDate(start);
    if (isWeekend(start) || isHoliday(dateStr, holidays)) return 0;
    return 0.5;
  }

  const rule = LEAVE_RULES[String(leave.leave_type ?? "").trim().toLowerCase()];
  if (!rule) return countBusinessDays(start, end, holidays);
  return rule.unit === "calendar_days"
    ? countCalendarDays(start, end)
    : countBusinessDays(start, end, holidays);
};

const buildQuotaDecisionMap = (
  perLeave: Record<number, { overQuota: boolean; exceedDate: string | null }>,
): Map<number, QuotaDecision> =>
  new Map(
    Object.entries(perLeave).map(([leaveId, value]) => [
      Number(leaveId),
      {
        overQuota: Boolean(value.overQuota),
        exceedDate: value.exceedDate ? parseLocalDateString(value.exceedDate) : null,
      },
    ]),
  );

const addReasonWeight = (
  bucket: Map<number, number>,
  reason: DeductionReason,
): void => {
  if (!reason.leave_record_id) return;
  const leaveId = Number(reason.leave_record_id);
  if (!Number.isFinite(leaveId)) return;
  bucket.set(leaveId, (bucket.get(leaveId) ?? 0) + Number(reason.weight ?? 0));
};

export function buildPayrollLeaveImpactSummary(
  input: BuildPayrollLeaveImpactSummaryInput,
): PayrollLeaveImpactSummary {
  const { year, month, baseRate, quotaRow, holidays } = input;
  const monthStart = makeLocalDate(year, month - 1, 1);
  const monthEnd = makeLocalDate(year, month, 0);
  const daysInMonth = monthEnd.getDate();
  const dailyRate = daysInMonth > 0 ? baseRate / daysInMonth : 0;
  const studyLeaveRows = buildStudyLeaveRowsFromMovements(input.movementRows ?? [], monthEnd);
  const leaveRows = assignSyntheticIdsToLeaves([
    ...(input.leaveRows as LeaveRow[]),
    ...studyLeaveRows,
  ]) as LeavePolicyInputRow[];

  const fiscalYear = month >= 10 ? year + 1 : year;
  const fiscalStart = makeLocalDate(fiscalYear - 1, 9, 1);
  const beforePeriodEnd = makeLocalDate(year, month - 1, 0);

  const beforeStatus = calculateLeaveQuotaStatus({
    leaveRows,
    holidays,
    quota: quotaRow ?? {},
    rules: LEAVE_RULES,
    serviceStartDate: null,
    rangeStart: fiscalStart,
    rangeEnd: beforePeriodEnd,
  });

  const afterStatus = calculateLeaveQuotaStatus({
    leaveRows,
    holidays,
    quota: quotaRow ?? {},
    rules: LEAVE_RULES,
    serviceStartDate: null,
    rangeStart: fiscalStart,
    rangeEnd: monthEnd,
  });

  const { deductionMap, reasonsByDate } = calculateDeductions(
    leaveRows as LeaveRow[],
    holidays,
    monthStart,
    monthEnd,
    buildQuotaDecisionMap(afterStatus.perLeave),
    input.noSalaryRows ?? [],
    new Map(
      (input.returnReportRows ?? []).map((row) => [
        Number(row.leave_record_id),
        new Date(row.return_date),
      ]),
    ),
  );

  const deductedDaysByLeaveId = new Map<number, number>();
  for (const reasons of reasonsByDate.values()) {
    for (const reason of reasons) addReasonWeight(deductedDaysByLeaveId, reason);
  }

  const leavesInPeriod = (leaveRows as LeaveImpactInputRow[])
    .map((leave) => {
      const rawStart = resolveEffectiveDate(leave.document_start_date, leave.start_date);
      const rawEnd = resolveEffectiveDate(leave.document_end_date, leave.end_date);
      const overlapStart = rawStart < monthStart ? monthStart : rawStart;
      const overlapEnd = rawEnd > monthEnd ? monthEnd : rawEnd;
      if (overlapEnd < overlapStart) return null;

      const leaveRecordId =
        leave.id !== undefined && leave.id !== null ? Number(leave.id) : null;
      const leaveStatus =
        leaveRecordId !== null ? afterStatus.perLeave[leaveRecordId] : undefined;
      const deductedDays =
        leaveRecordId !== null ? Number(deductedDaysByLeaveId.get(leaveRecordId) ?? 0) : 0;
      const daysInPeriod = calculateOverlapDuration(leave, overlapStart, overlapEnd, holidays);
      const isNoPay = Number(leave.is_no_pay ?? 0) === 1 || Number(leave.pay_exception ?? 0) === 1;

      return {
        leaveRecordId,
        leaveType: String(leave.leave_type ?? ""),
        startDate: formatLocalDate(rawStart),
        endDate: formatLocalDate(rawEnd),
        overlapStartDate: formatLocalDate(overlapStart),
        overlapEndDate: formatLocalDate(overlapEnd),
        daysInPeriod,
        deductedDays,
        deductedAmount: Number((deductedDays * dailyRate).toFixed(2)),
        isNoPay,
        overQuota: Boolean(leaveStatus?.overQuota),
        exceedDate: leaveStatus?.exceedDate ?? null,
        returnReportStatus:
          leave.return_report_status === null || leave.return_report_status === undefined
            ? null
            : String(leave.return_report_status),
        studyInstitution:
          leave.study_institution === null || leave.study_institution === undefined
            ? null
            : String(leave.study_institution),
        studyProgram:
          leave.study_program === null || leave.study_program === undefined
            ? null
            : String(leave.study_program),
        studyMajor:
          leave.study_major === null || leave.study_major === undefined
            ? null
            : String(leave.study_major),
      } satisfies PayrollLeaveImpactLeave;
    })
    .filter((leave): leave is PayrollLeaveImpactLeave => Boolean(leave))
    .sort((left, right) => {
      if (left.overlapStartDate !== right.overlapStartDate) {
        return left.overlapStartDate.localeCompare(right.overlapStartDate);
      }
      return (left.leaveRecordId ?? 0) - (right.leaveRecordId ?? 0);
    });

  const leaveTypesInPeriod = new Set(leavesInPeriod.map((leave) => leave.leaveType));
  const quotaTypes = new Set([
    ...Object.keys(beforeStatus.perType),
    ...Object.keys(afterStatus.perType),
    ...Array.from(leaveTypesInPeriod),
  ]);

  const quotaByType: PayrollLeaveImpactQuota[] = [];
  for (const leaveType of quotaTypes) {
      const normalizedLeaveType = String(leaveType ?? "").trim().toLowerCase();
      const before = beforeStatus.perType[normalizedLeaveType];
      const after = afterStatus.perType[normalizedLeaveType];
      const quotaLimit = after?.limit ?? before?.limit ?? null;
      const usedBeforePeriod = Number(before?.used ?? 0);
      const usedAfterPeriod = Number(after?.used ?? 0);

      if (
        quotaLimit === null &&
        usedBeforePeriod <= 0 &&
        usedAfterPeriod <= 0 &&
        !leaveTypesInPeriod.has(leaveType)
      ) {
        continue;
      }

      quotaByType.push({
        leaveType,
        quotaLimit,
        ruleType: LEAVE_RULES[normalizedLeaveType]?.rule_type ?? "cumulative",
        tracksBalance: (LEAVE_RULES[normalizedLeaveType]?.rule_type ?? "cumulative") === "cumulative",
        quotaUnit: LEAVE_RULES[normalizedLeaveType]?.unit ?? null,
        usedBeforePeriod,
        usedInPeriod: Math.max(0, usedAfterPeriod - usedBeforePeriod),
        remainingBeforePeriod: before?.remaining ?? null,
        remainingAfterPeriod: after?.remaining ?? null,
        overQuota: Boolean(after?.overQuota),
        exceedDate: after?.exceedDate ?? null,
      });
    }
  quotaByType.sort((left, right) => left.leaveType.localeCompare(right.leaveType, "th"));

  const deductedDays = Number(
    Array.from(deductionMap.values()).reduce((total, value) => total + Number(value ?? 0), 0),
  );

  return {
    deductedDays,
    deductedAmount: Number((deductedDays * dailyRate).toFixed(2)),
    leavesInPeriod,
    quotaByType,
  };
}

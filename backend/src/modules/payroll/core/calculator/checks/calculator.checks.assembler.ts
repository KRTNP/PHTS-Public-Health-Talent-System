import { Decimal } from "decimal.js";
import {
  DeductionReason,
  LeaveRow,
} from "@/modules/payroll/core/deductions/deductions.js";
import { formatLocalDate } from "@/modules/payroll/core/utils/date.utils.js";
import { RETURN_REPORT_REQUIRED_LEAVE_TYPES } from "@/modules/payroll/payroll.constants.js";
import type {
  LicenseRow,
  MovementRow,
  PayrollCheck,
  PayrollCheckCode,
} from "@/modules/payroll/core/calculator/facade/calculator.js";
import type {
  EligibilityInfo,
  EligibilityState,
  PaymentTotals,
} from "@/modules/payroll/core/calculator/engine/calculator.engine.js";
import {
  applyDailyTotals,
  getActiveEligibility,
} from "@/modules/payroll/core/calculator/engine/calculator.engine.js";
import type { WorkPeriod } from "@/modules/payroll/core/calculator/facade/calculator.work-period.js";
import {
  addEligibilityGapRangeEvidence,
  addOverlappingEligibilityEvidence,
  applyDailyCheckImpact,
  buildEligibilityGapRanges,
  checkTitle,
  type CheckAgg,
  type DailyCheckImpactContext,
  type EligibilityCoverage,
  pushEvidence,
  reasonSeverity,
  setEligibilityGapRange,
  type EnsureAggFn,
  type UpdateAggRangeFn,
  updateEligibilityCoverage,
} from "@/modules/payroll/core/calculator/checks/calculator.checks.rules.js";

type CheckAccumulator = {
  checkAggs: Map<PayrollCheckCode, CheckAgg>;
  ensureAgg: EnsureAggFn;
  updateAggRange: UpdateAggRangeFn;
};

type DailyPeriodsContext = {
  orderedPeriods: WorkPeriod[];
  eligibilities: EligibilityInfo[];
  eligibilityState: EligibilityState;
  totals: PaymentTotals;
  licenseChecker: (dateStr: string) => boolean;
  reasonsByDate: Map<string, DeductionReason[]>;
  deductionMap: Map<string, number>;
  dailyCheckContext: DailyCheckImpactContext;
};

type EligibilityGapContext = {
  totals: PaymentTotals;
  workDaySet: Set<string>;
  coverage: EligibilityCoverage;
  startOfMonth: Date;
  endOfMonth: Date;
  firstWorkDay: string | null;
  lastWorkDay: string | null;
  eligibilities: EligibilityInfo[];
  ensureAgg: EnsureAggFn;
};

type MissingStartWorkDateContext = {
  startWorkDateStr: string | null;
  workDaySet: Set<string>;
  daysInMonth: number;
  firstWorkDay: string | null;
  lastWorkDay: string | null;
  startOfMonth: Date;
  endOfMonth: Date;
  ensureAgg: EnsureAggFn;
};

export const createCheckAccumulator = (): CheckAccumulator => {
  const checkAggs = new Map<PayrollCheckCode, CheckAgg>();
  const ensureAgg = (code: PayrollCheckCode): CheckAgg => {
    const existing = checkAggs.get(code);
    if (existing) return existing;
    const next: CheckAgg = {
      code,
      impactDays: 0,
      impactAmount: 0,
      startDate: null,
      endDate: null,
      evidence: [],
      evidenceKeySet: new Set(),
    };
    checkAggs.set(code, next);
    return next;
  };
  const updateAggRange = (agg: CheckAgg, dateStr: string): void => {
    if (!agg.startDate || dateStr < agg.startDate) agg.startDate = dateStr;
    if (!agg.endDate || dateStr > agg.endDate) agg.endDate = dateStr;
  };
  return { checkAggs, ensureAgg, updateAggRange };
};

export const buildLeaveByIdMap = (mergedLeaves: LeaveRow[]): Map<number, LeaveRow> => {
  const leaveById = new Map<number, LeaveRow>();
  for (const leave of mergedLeaves) {
    if (leave.id !== undefined && leave.id !== null) leaveById.set(Number(leave.id), leave);
  }
  return leaveById;
};

export const markMissingStartWorkDateCheck = ({
  startWorkDateStr,
  workDaySet,
  daysInMonth,
  firstWorkDay,
  lastWorkDay,
  startOfMonth,
  endOfMonth,
  ensureAgg,
}: MissingStartWorkDateContext): void => {
  if (startWorkDateStr) return;
  const agg = ensureAgg("MISSING_START_WORK_DATE");
  agg.impactDays = workDaySet.size > 0 ? workDaySet.size : daysInMonth;
  agg.impactAmount = 0;
  agg.startDate = firstWorkDay ?? formatLocalDate(startOfMonth);
  agg.endDate = lastWorkDay ?? formatLocalDate(endOfMonth);
};

export const addPendingReturnReportChecks = (
  mergedLeaves: LeaveRow[],
  endOfMonth: Date,
  ensureAgg: EnsureAggFn,
  updateAggRange: UpdateAggRangeFn,
): void => {
  const returnReportRequiredTypes = new Set<string>(RETURN_REPORT_REQUIRED_LEAVE_TYPES);
  const monthEndStr = formatLocalDate(endOfMonth);
  for (const leave of mergedLeaves) {
    const leaveType = String(leave.leave_type ?? "");
    if (!returnReportRequiredTypes.has(leaveType)) continue;
    if (leave.id === undefined || leave.id === null || Number(leave.id) <= 0) continue;
    if (Number(leave.require_return_report ?? 0) !== 1) continue;

    const status = String((leave as any).return_report_status ?? "").toUpperCase();
    if (status === "DONE") continue;

    const leaveEndStr = formatLocalDate((leave as any).document_end_date ?? leave.end_date);
    if (!leaveEndStr || leaveEndStr > monthEndStr) continue;

    const agg = ensureAgg("PENDING_RETURN_REPORT");
    agg.impactDays += 1;
    updateAggRange(agg, leaveEndStr);
    pushEvidence(agg, `leave:${leave.id}:pending_return`, {
      type: "leave",
      leave_record_id: Number(leave.id),
      leave_type: leaveType,
      start_date: formatLocalDate((leave as any).document_start_date ?? leave.start_date),
      end_date: leaveEndStr,
      return_report_status: status || null,
    });
  }
};

export const processDailyPeriods = ({
  orderedPeriods,
  eligibilities,
  eligibilityState,
  totals,
  licenseChecker,
  reasonsByDate,
  deductionMap,
  dailyCheckContext,
}: DailyPeriodsContext): EligibilityCoverage => {
  const coverage: EligibilityCoverage = {
    daysWithEligibilityRate: 0,
    firstEligibilityDay: null,
    lastEligibilityDay: null,
  };

  for (const period of orderedPeriods) {
    for (let d = new Date(period.start); d <= period.end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatLocalDate(d);
      const activeEligibility = getActiveEligibility(eligibilityState, eligibilities, d.getTime());
      const currentRate = activeEligibility ? activeEligibility.rate : 0;

      if (activeEligibility) {
        totals.lastRateSnapshot = currentRate;
        totals.lastMasterRateId = activeEligibility.rateId;
        totals.lastProfessionCode = activeEligibility.professionCode;
        totals.lastGroupNo = activeEligibility.groupNo;
        totals.lastItemNo = activeEligibility.itemNo;
      }
      updateEligibilityCoverage(coverage, dateStr, currentRate);

      const hasLicense = licenseChecker(dateStr);
      const reasons = reasonsByDate.get(dateStr) || [];
      const deductionWeight = deductionMap.get(dateStr) || 0;
      applyDailyTotals(
        totals,
        currentRate,
        hasLicense,
        deductionWeight,
        dailyCheckContext.daysInMonth,
      );
      applyDailyCheckImpact(
        { currentRate, hasLicense, reasons, deductionWeight, dateStr },
        dailyCheckContext,
      );
    }
  }

  return coverage;
};

export const addLicenseEvidence = (
  checkAggs: Map<PayrollCheckCode, CheckAgg>,
  licenses: LicenseRow[],
): void => {
  const agg = checkAggs.get("NO_LICENSE");
  if (!agg) return;
  for (const lic of licenses) {
    pushEvidence(
      agg,
      `license:${formatLocalDate(lic.valid_from)}:${formatLocalDate(lic.valid_until)}:${lic.status}`,
      {
        type: "license",
        valid_from: formatLocalDate(lic.valid_from),
        valid_until: formatLocalDate(lic.valid_until),
        status: String(lic.status ?? ""),
        license_name: (lic as any).license_name ?? undefined,
        license_type: (lic as any).license_type ?? undefined,
        occupation_name: (lic as any).occupation_name ?? undefined,
      },
    );
  }
};

export const addNotWorkingCheck = (
  workDaySet: Set<string>,
  daysInMonth: number,
  movements: MovementRow[],
  endOfMonth: Date,
  ensureAgg: EnsureAggFn,
): void => {
  if (!(workDaySet.size > 0 && workDaySet.size < daysInMonth)) return;
  const agg = ensureAgg("NOT_WORKING");
  agg.impactDays = daysInMonth - workDaySet.size;
  agg.impactAmount = 0;
  movements
    .filter((m) => new Date(m.effective_date) <= endOfMonth)
    .slice(-10)
    .forEach((m) => {
      pushEvidence(agg, `movement:${formatLocalDate(m.effective_date)}:${m.movement_type}`, {
        type: "movement",
        movement_type: String(m.movement_type),
        effective_date: formatLocalDate(m.effective_date),
      });
    });
};

export const addEligibilityGapCheck = ({
  totals,
  workDaySet,
  coverage,
  startOfMonth,
  endOfMonth,
  firstWorkDay,
  lastWorkDay,
  eligibilities,
  ensureAgg,
}: EligibilityGapContext): void => {
  if (!(totals.lastRateSnapshot > 0 && workDaySet.size > 0)) return;
  if (coverage.daysWithEligibilityRate >= workDaySet.size) return;

  const agg = ensureAgg("ELIGIBILITY_GAP");
  agg.impactDays = workDaySet.size - coverage.daysWithEligibilityRate;
  const expectedFull = totals.lastRateSnapshot;
  agg.impactAmount = Math.max(
    0,
    expectedFull -
      Number(totals.totalPayment.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()),
  );
  const monthStartStr = formatLocalDate(startOfMonth);
  const monthEndStr = formatLocalDate(endOfMonth);
  const missingRanges = buildEligibilityGapRanges(firstWorkDay, lastWorkDay, coverage);
  setEligibilityGapRange(agg, missingRanges);
  addEligibilityGapRangeEvidence(
    agg,
    missingRanges,
    monthStartStr,
    monthEndStr,
    firstWorkDay,
    lastWorkDay,
  );
  addOverlappingEligibilityEvidence(agg, eligibilities, monthStartStr, monthEndStr);
};

export const buildPayrollChecks = (checkAggs: Map<PayrollCheckCode, CheckAgg>): PayrollCheck[] => {
  return Array.from(checkAggs.values())
    .filter((agg) => agg.impactDays > 0.0001 || Math.abs(agg.impactAmount) > 0.01)
    .map((agg) => {
      const severity = reasonSeverity(agg.code);
      const impactDays = Number.parseFloat(agg.impactDays.toFixed(2));
      const impactAmount =
        agg.code === "NOT_WORKING"
          ? null
          : Number.parseFloat(agg.impactAmount.toFixed(2));
      const title = checkTitle(agg.code);
      const summaryParts: string[] = [];
      if (agg.code === "PENDING_RETURN_REPORT") {
        summaryParts.push(`พบ ${impactDays.toLocaleString("th-TH")} รายการที่ยังไม่รายงานตัวกลับ`);
      } else {
        summaryParts.push(`กระทบ ${impactDays.toLocaleString("th-TH")} วัน`);
        if (impactAmount !== null && impactAmount > 0) {
          summaryParts.push(`ประมาณ -${impactAmount.toLocaleString("th-TH")} บาท`);
        }
      }
      if (agg.code === "ELIGIBILITY_GAP" && agg.rangeLabel) {
        summaryParts.push(`ไม่มีสิทธิ ${agg.rangeLabel}`);
      } else if (agg.startDate && agg.endDate) {
        summaryParts.push(`${agg.startDate} ถึง ${agg.endDate}`);
      }
      return {
        code: agg.code,
        severity,
        title,
        summary: summaryParts.join(" • "),
        impactDays,
        impactAmount,
        startDate: agg.startDate,
        endDate: agg.endDate,
        evidence: agg.evidence,
      };
    })
    .sort((a, b) => {
      const sevA = a.severity === "BLOCKER" ? 0 : 1;
      const sevB = b.severity === "BLOCKER" ? 0 : 1;
      if (sevA !== sevB) return sevA - sevB;
      const amtA = a.impactAmount ?? 0;
      const amtB = b.impactAmount ?? 0;
      if (amtA !== amtB) return amtB - amtA;
      return b.impactDays - a.impactDays;
    });
};

import { RowDataPacket } from 'mysql2/promise';
import { LEAVE_RULES } from '../payroll.constants.js';
import {
  countBusinessDays,
  countCalendarDays,
  formatLocalDate,
  isHoliday,
} from './utils.js';

export interface LeaveRow extends RowDataPacket {
  leave_type: string;
  start_date: Date | string;
  end_date: Date | string;
  duration_days: number;
  is_no_pay?: number | null;
}

type QuotaValue = number | string | null;

export interface QuotaRow extends RowDataPacket {
  quota_vacation?: QuotaValue;
  quota_personal?: QuotaValue;
  quota_sick?: QuotaValue;
}

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const applyNoPayLeave = (
  deductionMap: Map<string, number>,
  start: Date,
  end: Date,
  monthStart: Date,
  monthEnd: Date,
) => {
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = formatLocalDate(cursor);
    if (cursor >= monthStart && cursor <= monthEnd) {
      deductionMap.set(dateStr, Math.max(deductionMap.get(dateStr) || 0, 1));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
};

const resolveLeaveLimit = (type: string, ruleLimit: number | null, quota: QuotaRow) => {
  if (type === 'vacation') {
    return quota.quota_vacation !== null && quota.quota_vacation !== undefined
      ? Number(quota.quota_vacation)
      : ruleLimit;
  }
  if (type === 'personal') {
    return quota.quota_personal !== null && quota.quota_personal !== undefined
      ? Number(quota.quota_personal)
      : ruleLimit;
  }
  if (type === 'sick') {
    return quota.quota_sick !== null && quota.quota_sick !== undefined
      ? Number(quota.quota_sick)
      : ruleLimit;
  }
  return ruleLimit;
};

const calculateLeaveDuration = (
  leave: LeaveRow,
  start: Date,
  end: Date,
  holidays: string[],
  ruleUnit: string,
): { duration: number; isHalfDay: boolean } => {
  const isHalfDay = leave.duration_days > 0 && leave.duration_days < 1;
  if (isHalfDay) {
    const dateStr = formatLocalDate(start);
    if (!isHoliday(dateStr, holidays) && !isWeekend(start)) {
      return { duration: 0.5, isHalfDay: true };
    }
    return { duration: 0, isHalfDay: true };
  }
  if (ruleUnit === 'business_days') {
    return { duration: countBusinessDays(start, end, holidays), isHalfDay: false };
  }
  return { duration: countCalendarDays(start, end), isHalfDay: false };
};

const calculateExceedDate = (
  start: Date,
  end: Date,
  remainingQuota: number,
  isHalfDay: boolean,
  ruleUnit: string,
  holidays: string[],
): Date | null => {
  if (isHalfDay) {
    return remainingQuota < 0.5 ? new Date(start) : null;
  }

  if (ruleUnit === 'calendar_days') {
    const exceedDate = new Date(start);
    exceedDate.setDate(exceedDate.getDate() + Math.floor(remainingQuota));
    return exceedDate;
  }

  if (remainingQuota <= 0) {
    return new Date(start);
  }

  let daysFound = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = formatLocalDate(cursor);
    if (!isHoliday(dateStr, holidays) && !isWeekend(cursor)) {
      daysFound += 1;
      if (daysFound >= remainingQuota) break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (daysFound >= remainingQuota) {
    cursor.setDate(cursor.getDate() + 1);
    return cursor;
  }

  return null;
};

type PenaltyContext = {
  deductionMap: Map<string, number>;
  exceedDate: Date;
  end: Date;
  weight: number;
  ruleUnit: string;
  holidays: string[];
  monthStart: Date;
  monthEnd: Date;
};

const applyPenalty = ({
  deductionMap,
  exceedDate,
  end,
  weight,
  ruleUnit,
  holidays,
  monthStart,
  monthEnd,
}: PenaltyContext) => {
  const penaltyCursor = new Date(exceedDate);
  while (penaltyCursor <= end) {
    const dateStr = formatLocalDate(penaltyCursor);
    const isHol = isHoliday(dateStr, holidays);
    const weekend = isWeekend(penaltyCursor);

    if (ruleUnit === 'calendar_days' || (!isHol && !weekend)) {
      if (penaltyCursor >= monthStart && penaltyCursor <= monthEnd) {
        const currentWeight = deductionMap.get(dateStr) || 0;
        deductionMap.set(dateStr, Math.min(1, currentWeight + weight));
      }
    }
    penaltyCursor.setDate(penaltyCursor.getDate() + 1);
  }
};

export function calculateDeductions(
  leaves: LeaveRow[],
  quota: QuotaRow,
  holidays: string[],
  monthStart: Date,
  monthEnd: Date,
): Map<string, number> {
  const deductionMap = new Map<string, number>();
  const usage: Record<string, number> = { sick: 0, personal: 0, vacation: 0, wife_help: 0 };

  const sortedLeaves = [...leaves].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
  );

  for (const leave of sortedLeaves) {
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    applyLeaveDeduction(leave, {
      deductionMap,
      usage,
      quota,
      holidays,
      monthStart,
      monthEnd,
      start,
      end,
    });
  }

  return deductionMap;
}

type LeaveDeductionContext = {
  deductionMap: Map<string, number>;
  usage: Record<string, number>;
  quota: QuotaRow;
  holidays: string[];
  monthStart: Date;
  monthEnd: Date;
  start: Date;
  end: Date;
};

function applyLeaveDeduction(leave: LeaveRow, context: LeaveDeductionContext) {
  if (isNoPayLeave(leave)) {
    applyNoPayLeave(context.deductionMap, context.start, context.end, context.monthStart, context.monthEnd);
    return;
  }

  const rule = LEAVE_RULES[leave.leave_type];
  if (!rule) return;

  const limit = resolveLeaveLimit(leave.leave_type, rule.limit, context.quota);
  const { duration, isHalfDay } = calculateLeaveDuration(
    leave,
    context.start,
    context.end,
    context.holidays,
    rule.unit,
  );

  const currentUsage = context.usage[leave.leave_type] || 0;
  if (rule.rule_type === 'cumulative') {
    context.usage[leave.leave_type] = currentUsage + duration;
  }

  if (limit === null || currentUsage + duration <= limit) return;

  const remainingQuota = Math.max(0, limit - currentUsage);
  const exceedDate = calculateExceedDate(
    context.start,
    context.end,
    remainingQuota,
    isHalfDay,
    rule.unit,
    context.holidays,
  );

  if (!exceedDate) return;

  const weight = isHalfDay ? 0.5 : 1;
  applyPenalty({
    deductionMap: context.deductionMap,
    exceedDate,
    end: context.end,
    weight,
    ruleUnit: rule.unit,
    holidays: context.holidays,
    monthStart: context.monthStart,
    monthEnd: context.monthEnd,
  });
}

function isNoPayLeave(leave: LeaveRow): boolean {
  return Number(leave.is_no_pay ?? 0) === 1;
}

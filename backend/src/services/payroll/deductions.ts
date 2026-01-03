import { RowDataPacket } from 'mysql2/promise';
import { LEAVE_RULES, LeaveRuleType, LeaveUnit } from '../../config/payroll.constants.js';
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
}

export interface QuotaRow extends RowDataPacket {
  quota_vacation?: number | string | null;
  quota_personal?: number | string | null;
  quota_sick?: number | string | null;
}

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
    const type = leave.leave_type;
    const rule = LEAVE_RULES[type];
    if (!rule) continue;

    let limit = rule.limit;
    if (type === 'vacation') limit = Number(quota.quota_vacation ?? 10);
    if (type === 'personal') limit = Number(quota.quota_personal ?? 45);
    if (type === 'sick') limit = Number(quota.quota_sick ?? 60);

    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);
    const isHalfDay = leave.duration_days === 0.5;

    let duration = 0;
    if (rule.unit === 'business_days') {
      duration = countBusinessDays(start, end, holidays);
    } else {
      duration = countCalendarDays(start, end);
    }
    if (isHalfDay) duration = 0.5;

    const currentUsage = usage[type] || 0;
    const remaining = limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - currentUsage);

    if (rule.rule_type === 'cumulative') {
      usage[type] = currentUsage + duration;
    }

    if (duration > remaining) {
      const exceedAmount = duration - remaining;

      let deductCount = 0;
      const cursor = new Date(end);
      while (deductCount < exceedAmount && cursor >= start) {
        const dateStr = formatLocalDate(cursor);
        const isHol = isHoliday(dateStr, holidays);
        const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;

        if (rule.unit === 'calendar_days' || (!isHol && !isWeekend)) {
          if (cursor >= monthStart && cursor <= monthEnd) {
            const weight = isHalfDay ? 0.5 : 1;
            deductionMap.set(dateStr, (deductionMap.get(dateStr) || 0) + weight);
          }
          deductCount += isHalfDay ? 0.5 : 1;
        }
        cursor.setDate(cursor.getDate() - 1);
      }
    }
  }

  return deductionMap;
}

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
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);

    if (Number(leave.is_no_pay ?? 0) === 1) {
      const cursor = new Date(start);
      while (cursor <= end) {
        const dateStr = formatLocalDate(cursor);
        if (cursor >= monthStart && cursor <= monthEnd) {
          deductionMap.set(dateStr, Math.max(deductionMap.get(dateStr) || 0, 1));
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      continue;
    }

    const rule = LEAVE_RULES[type];
    if (!rule) continue;

    let limit = rule.limit;
    if (type === 'vacation') {
      limit = quota.quota_vacation !== null && quota.quota_vacation !== undefined
        ? Number(quota.quota_vacation)
        : limit;
    }
    if (type === 'personal') {
      limit = quota.quota_personal !== null && quota.quota_personal !== undefined
        ? Number(quota.quota_personal)
        : limit;
    }
    if (type === 'sick') {
      limit = quota.quota_sick !== null && quota.quota_sick !== undefined
        ? Number(quota.quota_sick)
        : limit;
    }
    const isHalfDay = leave.duration_days > 0 && leave.duration_days < 1;

    let duration = 0;
    if (isHalfDay) {
      const dateStr = formatLocalDate(start);
      const isHol = isHoliday(dateStr, holidays);
      const isWeekend = start.getDay() === 0 || start.getDay() === 6;
      if (!isHol && !isWeekend) duration = 0.5;
    } else if (rule.unit === 'business_days') {
      duration = countBusinessDays(start, end, holidays);
    } else {
      duration = countCalendarDays(start, end);
    }

    const currentUsage = usage[type] || 0;

    if (rule.rule_type === 'cumulative') {
      usage[type] = currentUsage + duration;
    }

    if (limit !== null && currentUsage + duration > limit) {
      const remainingQuota = Math.max(0, limit - currentUsage);
      let exceedDate: Date | null = null;

      if (isHalfDay) {
        if (duration > 0 && remainingQuota < 0.5) {
          exceedDate = start;
        }
      } else if (rule.unit === 'calendar_days') {
        exceedDate = new Date(start);
        exceedDate.setDate(exceedDate.getDate() + Math.floor(remainingQuota));
      } else if (remainingQuota <= 0) {
        exceedDate = new Date(start);
      } else {
        let daysFound = 0;
        const cursor = new Date(start);
        while (cursor <= end) {
          const dateStr = formatLocalDate(cursor);
          const isHol = isHoliday(dateStr, holidays);
          const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;

          if (!isHol && !isWeekend) {
            daysFound += 1;
            if (daysFound >= remainingQuota) break;
          }
          cursor.setDate(cursor.getDate() + 1);
        }

        if (daysFound >= remainingQuota) {
          cursor.setDate(cursor.getDate() + 1);
          exceedDate = cursor;
        }
      }

      if (exceedDate) {
        const weight = isHalfDay ? 0.5 : 1;
        const penaltyCursor = new Date(exceedDate);
        while (penaltyCursor <= end) {
          const dateStr = formatLocalDate(penaltyCursor);
          const isHol = isHoliday(dateStr, holidays);
          const isWeekend = penaltyCursor.getDay() === 0 || penaltyCursor.getDay() === 6;

          if (rule.unit === 'calendar_days' || (!isHol && !isWeekend)) {
            if (penaltyCursor >= monthStart && penaltyCursor <= monthEnd) {
              const currentWeight = deductionMap.get(dateStr) || 0;
              deductionMap.set(dateStr, Math.min(1, currentWeight + weight));
            }
          }
          penaltyCursor.setDate(penaltyCursor.getDate() + 1);
        }
      }
    }
  }

  return deductionMap;
}

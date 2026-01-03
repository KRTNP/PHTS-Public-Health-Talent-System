import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/database.js';

type LeaveUnit = 'business_days' | 'calendar_days';
type LeaveRuleType = 'cumulative' | 'per_event';

const LIFETIME_LICENSE_KEYWORDS: string[] = [
  'นายแพทย์',
  'ผู้อำนวยการเฉพาะด้าน (แพทย์)',
  'ทันตแพทย์',
  'ผู้อำนวยการเฉพาะด้าน (ทันตแพทย์)',
  'เภสัชกร',
  'ผู้อำนวยการเฉพาะด้าน (เภสัชกรรม)',
  'นักเทคนิคการแพทย์',
  'นักรังสีการแพทย์',
  'นักกายภาพบำบัด',
  'นักกิจกรรมบำบัด',
  'นักอาชีวบำบัด',
  'นักจิตวิทยาคลินิก',
  'นักเทคโนโลยีหัวใจ',
  'นักแก้ไขความผิดปกติ',
  'นักวิชาการศึกษาพิเศษ',
  'พยาบาลวิชาชีพ',
];

const LEAVE_RULES: Record<
  string,
  { limit: number | null; unit: LeaveUnit; rule_type: LeaveRuleType }
> = {
  sick: { limit: 60, unit: 'business_days', rule_type: 'cumulative' },
  personal: { limit: 45, unit: 'business_days', rule_type: 'cumulative' },
  vacation: { limit: null, unit: 'business_days', rule_type: 'cumulative' },
  wife_help: { limit: 15, unit: 'business_days', rule_type: 'cumulative' },
  maternity: { limit: 90, unit: 'calendar_days', rule_type: 'per_event' },
  ordain: { limit: 60, unit: 'calendar_days', rule_type: 'per_event' },
  military: { limit: 60, unit: 'calendar_days', rule_type: 'per_event' },
  education: { limit: 60, unit: 'calendar_days', rule_type: 'per_event' },
  rehab: { limit: 60, unit: 'calendar_days', rule_type: 'per_event' },
};

interface EligibilityRow extends RowDataPacket {
  effective_date: Date | string;
  expiry_date: Date | string | null;
  rate: number;
}

interface MovementRow extends RowDataPacket {
  effective_date: Date | string;
  movement_type: string;
}

interface LicenseRow extends RowDataPacket {
  valid_from: Date | string;
  valid_until: Date | string;
  status: string;
  license_name?: string;
  license_type?: string;
  occupation_name?: string;
}

interface LeaveRow extends RowDataPacket {
  leave_type: string;
  start_date: Date | string;
  end_date: Date | string;
  duration_days: number;
}

interface QuotaRow extends RowDataPacket {
  quota_vacation?: number | string | null;
  quota_personal?: number | string | null;
  quota_sick?: number | string | null;
}

interface HolidayRow extends RowDataPacket {
  holiday_date: Date | string;
}

interface EmployeeRow extends RowDataPacket {
  position_name?: string | null;
}

export interface CalculationResult {
  netPayment: number;
  totalDeductionDays: number;
  validLicenseDays: number;
  eligibleDays: number;
  remark: string;
  masterRateId: number | null;
  rateSnapshot: number;
  retroactiveTotal?: number;
  retroDetails?: RetroDetail[];
}

export interface RetroDetail {
  month: number;
  year: number;
  diff: number;
  remark: string;
}

interface WorkPeriod {
  start: Date;
  end: Date;
}

export async function calculateMonthly(
  citizenId: string,
  year: number,
  month: number,
): Promise<CalculationResult> {
  const startOfMonth = makeLocalDate(year, month - 1, 1);
  const endOfMonth = makeLocalDate(year, month, 0);
  const daysInMonth = endOfMonth.getDate();
  const fiscalYear = month >= 10 ? year + 1 + 543 : year + 543;

  const [
    [eligibilityRows],
    [movementRows],
    [employeeRows],
    [licenseRows],
    [leaveRows],
    [quotaRows],
    [holidayRows],
  ] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `
        SELECT e.effective_date, e.expiry_date, m.amount as rate, m.rate_id
        FROM pts_employee_eligibility e
        JOIN pts_master_rates m ON e.master_rate_id = m.rate_id
        WHERE e.citizen_id = ? AND e.is_active = 1
        AND e.effective_date <= ? 
        AND (e.expiry_date IS NULL OR e.expiry_date >= ?)
        ORDER BY e.effective_date ASC
      `,
      [citizenId, endOfMonth, startOfMonth],
    ),
    pool.query<RowDataPacket[]>(
      `
        SELECT * FROM pts_employee_movements 
        WHERE citizen_id = ? AND effective_date <= ?
        ORDER BY effective_date ASC, created_at ASC
      `,
      [citizenId, endOfMonth],
    ),
    pool.query<RowDataPacket[]>(
      `SELECT position_name FROM pts_employees WHERE citizen_id = ? LIMIT 1`,
      [citizenId],
    ),
    pool.query<RowDataPacket[]>(`SELECT * FROM pts_employee_licenses WHERE citizen_id = ?`, [
      citizenId,
    ]),
    pool.query<RowDataPacket[]>(
      `
        SELECT * FROM pts_leave_requests 
        WHERE citizen_id = ? AND fiscal_year = ?
        ORDER BY start_date ASC
      `,
      [citizenId, fiscalYear],
    ),
    pool.query<RowDataPacket[]>(`SELECT * FROM pts_leave_quotas WHERE citizen_id = ? AND fiscal_year = ?`, [
      citizenId,
      fiscalYear,
    ]),
    pool.query<RowDataPacket[]>(`SELECT holiday_date FROM pts_holidays WHERE holiday_date BETWEEN ? AND ?`, [
      `${year}-01-01`,
      `${year}-12-31`,
    ]),
  ]);

  const eligibilities = eligibilityRows as EligibilityRow[];
  const movements = movementRows as MovementRow[];
  const employee = (employeeRows as EmployeeRow[])[0] || {};
  const licenses = licenseRows as LicenseRow[];
  const leaves = leaveRows as LeaveRow[];
  const quota = ((quotaRows as QuotaRow[])[0] as QuotaRow | undefined) || ({} as QuotaRow);
  const holidays = (holidayRows as HolidayRow[]).map((h) => formatLocalDate(h.holiday_date));

  const { periods, remark } = resolveWorkPeriods(movements, startOfMonth, endOfMonth);
  if (periods.length === 0) {
    return emptyResult(remark || 'ไม่ได้ปฏิบัติงานในเดือนนี้');
  }

  const deductionMap = calculateDeductions(leaves, quota, holidays, startOfMonth, endOfMonth);

  let totalPayment = 0;
  let validLicenseDays = 0;
  let totalDeductionDays = 0;
  let daysCounted = 0;
  let lastRateSnapshot = 0;
  let lastMasterRateId: number | null = null;

  for (const period of periods) {
    for (let d = new Date(period.start); d <= period.end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatLocalDate(d);

      const activeElig = eligibilities.find((e) => {
        const eff = new Date(e.effective_date);
        const exp = e.expiry_date ? new Date(e.expiry_date) : makeLocalDate(9999, 11, 31);
        return d >= eff && d <= exp;
      });
      const currentRate = activeElig ? Number(activeElig.rate) : 0;
      if (activeElig) {
        lastRateSnapshot = currentRate;
        lastMasterRateId = (activeElig as any).rate_id ?? null;
      }

      const hasLicense = checkLicense(licenses, dateStr, employee.position_name || '');
      if (hasLicense) validLicenseDays++;

      const deductionWeight = deductionMap.get(dateStr) || 0;

      let eligibleWeight = hasLicense ? 1 : 0;
      eligibleWeight -= deductionWeight;
      if (eligibleWeight < 0) eligibleWeight = 0;

      if (deductionWeight > 0) totalDeductionDays += deductionWeight;
      if (eligibleWeight > 0) daysCounted += eligibleWeight;

      totalPayment += (currentRate / daysInMonth) * eligibleWeight;
    }
  }

  return {
    netPayment: parseFloat(totalPayment.toFixed(2)),
    totalDeductionDays,
    validLicenseDays,
    eligibleDays: daysCounted,
    remark,
    masterRateId: lastMasterRateId,
    rateSnapshot: lastRateSnapshot,
  };
}

export async function calculateRetroactive(
  citizenId: string,
  currentYear: number,
  currentMonth: number,
  lookBackMonths = 6,
): Promise<{ totalRetro: number; retroDetails: RetroDetail[] }> {
  let totalRetro = 0;
  const retroDetails: RetroDetail[] = [];

  for (let i = 1; i <= lookBackMonths; i++) {
    let targetMonth = currentMonth - i;
    let targetYear = currentYear;
    if (targetMonth <= 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    const [periodRows] = await pool.query<RowDataPacket[]>(
      `SELECT period_id, status FROM pts_periods WHERE period_month = ? AND period_year = ?`,
      [targetMonth, targetYear],
    );
    if (!Array.isArray(periodRows) || periodRows.length === 0) continue;
    const period = periodRows[0] as any;
    if (period.status && period.status !== 'CLOSED') continue;

    const [payoutRows] = await pool.query<RowDataPacket[]>(
      `SELECT calculated_amount FROM pts_payouts WHERE citizen_id = ? AND period_id = ?`,
      [citizenId, period.period_id],
    );
    const originalPaid = payoutRows.length ? Number((payoutRows[0] as any).calculated_amount) : 0;

    const [adjustmentRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT pi.item_type, pi.amount
        FROM pts_payout_items pi
        JOIN pts_payouts p ON pi.payout_id = p.payout_id
        WHERE p.citizen_id = ?
          AND pi.reference_month = ?
          AND pi.reference_year = ?
          AND pi.item_type IN ('RETROACTIVE_ADD', 'RETROACTIVE_DEDUCT')
      `,
      [citizenId, targetMonth, targetYear],
    );

    let historicalAdjustment = 0;
    if (Array.isArray(adjustmentRows)) {
      for (const adj of adjustmentRows as any[]) {
        if (adj.item_type === 'RETROACTIVE_ADD') {
          historicalAdjustment += Number(adj.amount);
        } else if (adj.item_type === 'RETROACTIVE_DEDUCT') {
          historicalAdjustment -= Number(adj.amount);
        }
      }
    }

    const paidAmount = originalPaid + historicalAdjustment;

    const recalculated = await calculateMonthly(citizenId, targetYear, targetMonth);
    const shouldBeAmount = recalculated.netPayment;

    const diff = parseFloat((shouldBeAmount - paidAmount).toFixed(2));
    if (Math.abs(diff) > 0.01) {
      totalRetro += diff;
      retroDetails.push({
        month: targetMonth,
        year: targetYear,
        diff,
        remark: `ปรับปรุงยอดเดือน ${targetMonth}/${targetYear}`,
      });
    }
  }

  return { totalRetro: parseFloat(totalRetro.toFixed(2)), retroDetails };
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

export function checkLicense(licenses: LicenseRow[], dateStr: string, positionName = ''): boolean {
  const keywordList = LIFETIME_LICENSE_KEYWORDS.map((kw) =>
    kw.trim().toLowerCase().normalize('NFC'),
  ).filter(Boolean);

  const normalizedPosition = positionName.toLowerCase().normalize('NFC');
  if (normalizedPosition && keywordList.some((kw) => normalizedPosition.includes(kw))) {
    return true;
  }

  return licenses.some((lic) => {
    if (keywordList.length > 0) {
      const combined = `${lic.license_name ?? ''} ${lic.license_type ?? ''} ${lic.occupation_name ?? ''}`
        .toLowerCase()
        .normalize('NFC');
      if (keywordList.some((kw) => combined.includes(kw))) return true;
    }

    const start = formatLocalDate(lic.valid_from);
    const end = formatLocalDate(lic.valid_until);
    const statusOk = (lic.status || '').toUpperCase() === 'ACTIVE';
    const withinRange = dateStr >= start && dateStr <= end;

    return statusOk && withinRange;
  });
}

export async function savePayout(
  conn: PoolConnection,
  periodId: number,
  citizenId: string,
  result: CalculationResult,
  masterRateId: number | null,
  baseRateSnapshot: number,
  referenceYear: number,
  referenceMonth: number,
): Promise<number> {
  const totalPayable = result.netPayment + (result.retroactiveTotal ?? 0);

  const [res] = await conn.query<ResultSetHeader>(
    `
      INSERT INTO pts_payouts 
      (period_id, citizen_id, master_rate_id, pts_rate_snapshot, calculated_amount, total_payable, deducted_days, eligible_days, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      periodId,
      citizenId,
      masterRateId,
      baseRateSnapshot,
      result.netPayment,
      totalPayable,
      result.totalDeductionDays,
      result.eligibleDays,
      result.remark,
    ],
  );

  const payoutId = res.insertId;

  if (result.netPayment !== 0) {
    await conn.query(
      `
        INSERT INTO pts_payout_items (payout_id, reference_month, reference_year, item_type, amount, description)
        VALUES (?, ?, ?, 'CURRENT', ?, 'ค่าตอบแทนงวดปัจจุบัน')
      `,
      [payoutId, referenceMonth, referenceYear, result.netPayment],
    );
  }

  if (result.retroDetails && result.retroDetails.length > 0) {
    for (const detail of result.retroDetails) {
      const itemType = detail.diff > 0 ? 'RETROACTIVE_ADD' : 'RETROACTIVE_DEDUCT';
      await conn.query(
        `
          INSERT INTO pts_payout_items (payout_id, reference_month, reference_year, item_type, amount, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [payoutId, detail.month, detail.year, itemType, Math.abs(detail.diff), detail.remark],
      );
    }
  } else if (result.retroactiveTotal && Math.abs(result.retroactiveTotal) > 0.01) {
    const itemType = result.retroactiveTotal > 0 ? 'RETROACTIVE_ADD' : 'RETROACTIVE_DEDUCT';
    await conn.query(
      `
        INSERT INTO pts_payout_items (payout_id, reference_month, reference_year, item_type, amount, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        payoutId,
        0,
        0,
        itemType,
        Math.abs(result.retroactiveTotal),
        'ปรับตกเบิกย้อนหลัง (รวมยอด)',
      ],
    );
  }

  return payoutId;
}

function resolveWorkPeriods(
  movements: MovementRow[],
  monthStart: Date,
  monthEnd: Date,
): { periods: WorkPeriod[]; remark: string } {
  const relevant = movements.filter((m) => new Date(m.effective_date) <= monthEnd);
  if (relevant.length === 0) {
    return { periods: [{ start: monthStart, end: monthEnd }], remark: '' };
  }
  // trust DB ordering (effective_date, created_at) to keep stable swaps in same day

  let remark = '';
  let active = false;

  for (const mov of relevant) {
    const date = new Date(mov.effective_date);
    if (date < monthStart) {
      if (mov.movement_type === 'ENTRY') active = true;
      else if (mov.movement_type === 'STUDY') {
        active = false;
        remark = 'ลาศึกษาต่อ';
      } else if (['RESIGN', 'RETIRE', 'DEATH', 'TRANSFER_OUT'].includes(mov.movement_type)) {
        active = false;
      }
    }
  }

  const periods: WorkPeriod[] = [];
  let currentStart: Date | null = active ? new Date(monthStart) : null;

  for (const mov of relevant) {
    const date = new Date(mov.effective_date);
    if (date < monthStart || date > monthEnd) continue;

    if (mov.movement_type === 'STUDY') {
      active = false;
      currentStart = null;
      remark = 'ลาศึกษาต่อ';
      break;
    }

    if (mov.movement_type === 'ENTRY') {
      if (!active) {
        active = true;
        currentStart = date < monthStart ? new Date(monthStart) : date;
      }
    } else if (['RESIGN', 'RETIRE', 'DEATH', 'TRANSFER_OUT'].includes(mov.movement_type)) {
      if (active && currentStart) {
        const end = makeLocalDate(date.getFullYear(), date.getMonth(), date.getDate() - 1);
        if (end >= monthStart) {
          periods.push({ start: currentStart, end: end > monthEnd ? monthEnd : end });
        }
      }
      active = false;
      currentStart = null;
    }
  }

  if (active && currentStart) {
    periods.push({ start: currentStart, end: monthEnd });
  }

  return { periods, remark };
}

function formatLocalDate(input: Date | string | null | undefined): string {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : new Date(input.getTime());
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeLocalDate(year: number, month: number, day: number): Date {
  return new Date(year, month, day, 0, 0, 0, 0);
}

function isHoliday(dateStr: string, holidays: string[]): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6 || holidays.includes(dateStr);
}

function countBusinessDays(start: Date, end: Date, holidays: string[]): number {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (!isHoliday(formatLocalDate(cur), holidays)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function countCalendarDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function emptyResult(remark: string): CalculationResult {
  return {
    netPayment: 0,
    totalDeductionDays: 0,
    validLicenseDays: 0,
    eligibleDays: 0,
    remark,
    masterRateId: null,
    rateSnapshot: 0,
  };
}

export const payrollService = {
  calculateMonthly,
  calculateRetroactive,
  calculateDeductions,
  checkLicense,
  savePayout,
};

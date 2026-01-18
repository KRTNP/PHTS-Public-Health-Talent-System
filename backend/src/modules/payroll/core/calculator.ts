import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { Decimal } from 'decimal.js';
import pool from '../../../config/database.js';
import { LIFETIME_LICENSE_KEYWORDS } from '../payroll.constants.js';
import { calculateDeductions, LeaveRow, QuotaRow } from './deductions.js';
import { formatLocalDate, makeLocalDate } from './utils.js';

export interface EligibilityRow extends RowDataPacket {
  effective_date: Date | string;
  expiry_date: Date | string | null;
  rate: number;
}

export interface MovementRow extends RowDataPacket {
  effective_date: Date | string;
  movement_type: string;
}

export interface LicenseRow extends RowDataPacket {
  valid_from: Date | string;
  valid_until: Date | string;
  status: string;
  license_name?: string;
  license_type?: string;
  occupation_name?: string;
}

export interface HolidayRow extends RowDataPacket {
  holiday_date: Date | string;
}

export interface EmployeeRow extends RowDataPacket {
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

const LIFETIME_KEYWORDS = LIFETIME_LICENSE_KEYWORDS.map((kw) =>
  kw.trim().toLowerCase().normalize('NFC'),
).filter(Boolean);

type EligibilityInfo = Readonly<{
  effectiveTs: number;
  expiryTs: number;
  rate: number;
  rateId: number | null;
}>;

type EligibilityState = {
  index: number;
  current: EligibilityInfo | null;
};

type PaymentTotals = {
  totalPayment: Decimal;
  validLicenseDays: number;
  totalDeductionDays: number;
  daysCounted: number;
  lastRateSnapshot: number;
  lastMasterRateId: number | null;
};

const buildEligibilities = (rows: EligibilityRow[]): EligibilityInfo[] =>
  rows
    .map((row) => ({
      effectiveTs: new Date(row.effective_date).getTime(),
      expiryTs: row.expiry_date
        ? new Date(row.expiry_date).getTime()
        : makeLocalDate(9999, 11, 31).getTime(),
      rate: Number(row.rate),
      rateId: (row as any).rate_id ?? null,
    }))
    .sort((a, b) => a.effectiveTs - b.effectiveTs);

const getActiveEligibility = (
  state: EligibilityState,
  eligibilities: EligibilityInfo[],
  dayTs: number,
): EligibilityInfo | null => {
  while (state.index < eligibilities.length && eligibilities[state.index].effectiveTs <= dayTs) {
    state.current = eligibilities[state.index];
    state.index += 1;
  }
  if (state.current && state.current.expiryTs >= dayTs) {
    return state.current;
  }
  return null;
};

const applyDailyTotals = (
  totals: PaymentTotals,
  currentRate: number,
  hasLicense: boolean,
  deductionWeight: number,
  daysInMonth: number,
) => {
  if (hasLicense) totals.validLicenseDays += 1;

  let eligibleWeight = hasLicense ? 1 : 0;
  eligibleWeight -= deductionWeight;
  if (eligibleWeight < 0) eligibleWeight = 0;

  if (deductionWeight > 0) totals.totalDeductionDays += deductionWeight;
  if (eligibleWeight > 0) totals.daysCounted += eligibleWeight;

  const dailyRate = new Decimal(currentRate || 0).div(daysInMonth);
  totals.totalPayment = totals.totalPayment.plus(dailyRate.mul(eligibleWeight));
};

function createLicenseChecker(licenses: LicenseRow[], positionName = ''): (dateStr: string) => boolean {
  const normalizedPosition = positionName.toLowerCase().normalize('NFC');
  if (normalizedPosition && LIFETIME_KEYWORDS.some((kw) => normalizedPosition.includes(kw))) {
    return () => true;
  }

  const hasLifetimeLicense = licenses.some((lic) => {
    if (!lic.license_name || LIFETIME_KEYWORDS.length === 0) return false;
    const combined = `${lic.license_name} ${lic.license_type ?? ''} ${lic.occupation_name ?? ''}`
      .toLowerCase()
      .normalize('NFC');
    return LIFETIME_KEYWORDS.some((kw) => combined.includes(kw));
  });

  if (hasLifetimeLicense) {
    return () => true;
  }

  const ranges = licenses
    .filter((lic) => (lic.status || '').toUpperCase() === 'ACTIVE')
    .map((lic) => ({
      start: formatLocalDate(lic.valid_from),
      end: formatLocalDate(lic.valid_until),
    }));

  return (dateStr: string) => ranges.some((range) => dateStr >= range.start && dateStr <= range.end);
}

export async function calculateMonthly(
  citizenId: string,
  year: number,
  month: number,
  connection?: PoolConnection,
): Promise<CalculationResult> {
  const dbConn: Pick<PoolConnection, 'query'> = connection ?? pool;
  const startOfMonth = makeLocalDate(year, month - 1, 1);
  const endOfMonth = makeLocalDate(year, month, 0);
  const daysInMonth = endOfMonth.getDate();
  const fiscalYear = month >= 10 ? year + 1 + 543 : year + 543;

  const [eligibilityRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT e.effective_date, e.expiry_date, m.amount as rate, m.rate_id
      FROM req_eligibility e
      JOIN cfg_payment_rates m ON e.master_rate_id = m.rate_id
      WHERE e.citizen_id = ? AND e.is_active = 1
      AND e.effective_date <= ? 
      AND (e.expiry_date IS NULL OR e.expiry_date >= ?)
      ORDER BY e.effective_date ASC
    `,
    [citizenId, endOfMonth, startOfMonth],
  );

  const [movementRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT * FROM emp_movements 
      WHERE citizen_id = ? AND effective_date <= ?
      ORDER BY effective_date ASC, created_at ASC
    `,
    [citizenId, endOfMonth],
  );

  const [employeeRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT position_name FROM emp_profiles WHERE citizen_id = ? LIMIT 1`,
    [citizenId],
  );

  const [licenseRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT * FROM emp_licenses WHERE citizen_id = ?`,
    [citizenId],
  );

  const [leaveRows] = await dbConn.query<RowDataPacket[]>(
    `
      SELECT * FROM leave_records 
      WHERE citizen_id = ? AND fiscal_year = ?
      ORDER BY start_date ASC
    `,
    [citizenId, fiscalYear],
  );

  const [quotaRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT * FROM leave_quotas WHERE citizen_id = ? AND fiscal_year = ?`,
    [citizenId, fiscalYear],
  );

  const [holidayRows] = await dbConn.query<RowDataPacket[]>(
    `SELECT holiday_date FROM cfg_holidays WHERE holiday_date BETWEEN ? AND ?`,
    [`${year - 1}-01-01`, `${year}-12-31`],
  );

  const eligibilities = buildEligibilities(eligibilityRows as EligibilityRow[]);
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
  const licenseChecker = createLicenseChecker(licenses, employee.position_name || '');
  const eligibilityState: EligibilityState = { index: 0, current: null };
  const totals: PaymentTotals = {
    totalPayment: new Decimal(0),
    validLicenseDays: 0,
    totalDeductionDays: 0,
    daysCounted: 0,
    lastRateSnapshot: 0,
    lastMasterRateId: null,
  };

  const orderedPeriods = [...periods].sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const period of orderedPeriods) {
    for (let d = new Date(period.start); d <= period.end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatLocalDate(d);
      const dayTs = d.getTime();

      const activeEligibility = getActiveEligibility(eligibilityState, eligibilities, dayTs);
      const currentRate = activeEligibility ? activeEligibility.rate : 0;

      if (activeEligibility) {
        totals.lastRateSnapshot = currentRate;
        totals.lastMasterRateId = activeEligibility.rateId;
      }

      const hasLicense = licenseChecker(dateStr);
      const deductionWeight = deductionMap.get(dateStr) || 0;
      applyDailyTotals(totals, currentRate, hasLicense, deductionWeight, daysInMonth);
    }
  }

  return {
    netPayment: totals.totalPayment
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber(),
    totalDeductionDays: totals.totalDeductionDays,
    validLicenseDays: totals.validLicenseDays,
    eligibleDays: totals.daysCounted,
    remark,
    masterRateId: totals.lastMasterRateId,
    rateSnapshot: totals.lastRateSnapshot,
  };
}

export function checkLicense(licenses: LicenseRow[], dateStr: string, positionName = ''): boolean {
  return createLicenseChecker(licenses, positionName)(dateStr);
}

type SavePayoutInput = {
  conn: PoolConnection;
  periodId: number;
  citizenId: string;
  result: CalculationResult;
  masterRateId: number | null;
  baseRateSnapshot: number;
  referenceYear: number;
  referenceMonth: number;
};

export async function savePayout({
  conn,
  periodId,
  citizenId,
  result,
  masterRateId,
  baseRateSnapshot,
  referenceYear,
  referenceMonth,
}: SavePayoutInput): Promise<number> {
  const totalPayable = result.netPayment + (result.retroactiveTotal ?? 0);

  const [res] = await conn.query<ResultSetHeader>(
    `
      INSERT INTO pay_results 
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
        INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
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
          INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [payoutId, detail.month, detail.year, itemType, Math.abs(detail.diff), detail.remark],
      );
    }
  } else if (result.retroactiveTotal && Math.abs(result.retroactiveTotal) > 0.01) {
    const itemType = result.retroactiveTotal > 0 ? 'RETROACTIVE_ADD' : 'RETROACTIVE_DEDUCT';
    await conn.query(
      `
        INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
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

  const exitTypes = new Set(['RESIGN', 'RETIRE', 'DEATH', 'TRANSFER_OUT']);
  const swapTypes = new Set(['RESIGN', 'TRANSFER_OUT']);
  const studyRemark = 'ลาศึกษาต่อ';
  const prevMovements = relevant.filter((m) => new Date(m.effective_date) < monthStart);
  const monthlyMovements = relevant.filter((m) => {
    const date = new Date(m.effective_date);
    return date >= monthStart && date <= monthEnd;
  });

  const state = initWorkPeriodState(prevMovements, monthStart, exitTypes, studyRemark);

  for (const mov of monthlyMovements) {
    applyMovement(state, mov, {
      monthStart,
      monthEnd,
      exitTypes,
      swapTypes,
      studyRemark,
    });
  }

  if (state.active && state.currentStart) {
    state.periods.push({ start: state.currentStart, end: monthEnd });
  }

  return { periods: state.periods, remark: state.remark };
}

type WorkPeriodState = {
  active: boolean;
  currentStart: Date | null;
  remark: string;
  prevMovement: MovementRow | null;
  periods: WorkPeriod[];
};

type MovementContext = {
  monthStart: Date;
  monthEnd: Date;
  exitTypes: Set<string>;
  swapTypes: Set<string>;
  studyRemark: string;
};

function initWorkPeriodState(
  prevMovements: MovementRow[],
  monthStart: Date,
  exitTypes: Set<string>,
  studyRemark: string,
): WorkPeriodState {
  let active = false;
  let remark = '';

  for (const mov of prevMovements) {
    if (mov.movement_type === 'ENTRY') {
      active = true;
      continue;
    }
    if (mov.movement_type === 'STUDY') {
      active = false;
      remark = studyRemark;
      continue;
    }
    if (exitTypes.has(mov.movement_type)) {
      active = false;
    }
  }

  return {
    active,
    currentStart: active ? new Date(monthStart) : null,
    remark,
    prevMovement: prevMovements.at(-1) ?? null,
    periods: [],
  };
}

function applyMovement(state: WorkPeriodState, mov: MovementRow, ctx: MovementContext) {
  const date = new Date(mov.effective_date);

  if (mov.movement_type === 'STUDY') {
    handleStudyMovement(state, date, ctx);
    state.prevMovement = mov;
    return;
  }

  if (mov.movement_type === 'ENTRY') {
    handleEntryMovement(state, mov, date, ctx);
    state.prevMovement = mov;
    return;
  }

  if (ctx.exitTypes.has(mov.movement_type)) {
    handleExitMovement(state, date, ctx);
  }

  state.prevMovement = mov;
}

function handleStudyMovement(state: WorkPeriodState, date: Date, ctx: MovementContext) {
  if (state.active && state.currentStart) {
    const end = makeLocalDate(date.getFullYear(), date.getMonth(), date.getDate() - 1);
    pushPeriod(state, end, ctx.monthEnd);
  }
  state.active = false;
  state.currentStart = null;
  state.remark = ctx.studyRemark;
}

function handleEntryMovement(
  state: WorkPeriodState,
  mov: MovementRow,
  date: Date,
  ctx: MovementContext,
) {
  const isSwap = isSwapEntry(state.prevMovement, date, ctx.swapTypes);
  if (isSwap && state.periods.length > 0) {
    restoreSwapStart(state, date);
  }

  if (!state.active || isSwap) {
    state.active = true;
    if (isSwap) {
      state.currentStart ??= date;
    } else {
      state.currentStart = date < ctx.monthStart ? new Date(ctx.monthStart) : date;
    }
  }
}

function handleExitMovement(state: WorkPeriodState, date: Date, ctx: MovementContext) {
  if (state.active && state.currentStart) {
    const end = makeLocalDate(date.getFullYear(), date.getMonth(), date.getDate() - 1);
    pushPeriod(state, end, ctx.monthEnd);
  }
  state.active = false;
  state.currentStart = null;
}

function isSwapEntry(
  prevMovement: MovementRow | null,
  date: Date,
  swapTypes: Set<string>,
): boolean {
  if (!prevMovement) return false;
  const prevDate = new Date(prevMovement.effective_date);
  const diffMs =
    makeLocalDate(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
    makeLocalDate(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate()).getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return swapTypes.has(prevMovement.movement_type) && diffDays <= 1;
}

function restoreSwapStart(state: WorkPeriodState, date: Date) {
  const lastPeriod = state.periods.pop();
  if (lastPeriod?.start) {
    state.currentStart = lastPeriod.start;
  } else {
    state.currentStart ??= date;
  }
}

function pushPeriod(state: WorkPeriodState, end: Date, monthEnd: Date) {
  if (!state.currentStart) return;
  if (end < state.currentStart) return;
  state.periods.push({ start: state.currentStart, end: clampEndDate(end, monthEnd) });
}

function clampEndDate(end: Date, monthEnd: Date): Date {
  const endTime = Math.min(end.getTime(), monthEnd.getTime());
  return new Date(endTime);
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
  calculateDeductions,
  checkLicense,
  savePayout,
};

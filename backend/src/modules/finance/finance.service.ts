/**
 * PHTS System - Finance Service
 *
 * Handles payment status updates and finance dashboard data.
 */

import { RowDataPacket } from 'mysql2/promise';
import { query, getConnection } from '../../config/database.js';
import { delCache, getJsonCache, setJsonCache } from '../../utils/cache.js';
import { NotificationService } from '../notification/notification.service.js';

const FINANCE_DASHBOARD_CACHE_KEY = 'finance:dashboard';

/**
 * Payment status enum
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

/**
 * Payout with details for finance view
 */
export interface PayoutWithDetails {
  payout_id: number;
  period_id: number;
  period_month: number;
  period_year: number;
  citizen_id: string;
  employee_name: string;
  department: string;
  pts_rate_snapshot: number;
  calculated_amount: number;
  retroactive_amount: number;
  total_payable: number;
  payment_status: PaymentStatus;
  paid_at: Date | null;
  paid_by: number | null;
}

/**
 * Finance summary for dashboard
 */
export interface FinanceSummary {
  period_id: number;
  period_month: number;
  period_year: number;
  period_status: string;
  total_employees: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  paid_count: number;
  pending_count: number;
}

/**
 * Yearly summary
 */
export interface YearlySummary {
  period_year: number;
  total_employees: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
}

/**
 * Mark a single payout as paid
 */
export async function markPayoutAsPaid(
  payoutId: number,
  paidByUserId: number,
  _comment?: string,
): Promise<void> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Verify payout exists and is pending
    const [payouts] = await connection.query<RowDataPacket[]>(
      `SELECT po.*, p.period_month, p.period_year
       FROM pay_results po
       JOIN pay_periods p ON po.period_id = p.period_id
       WHERE po.payout_id = ? FOR UPDATE`,
      [payoutId],
    );

    if (payouts.length === 0) {
      throw new Error('Payout not found');
    }

    const payout = payouts[0] as any;

    if (payout.payment_status === PaymentStatus.PAID) {
      throw new Error('Payout is already marked as paid');
    }

    if (payout.payment_status === PaymentStatus.CANCELLED) {
      throw new Error('Cannot mark cancelled payout as paid');
    }

    // Update payment status
    await connection.execute(
      `UPDATE pay_results
       SET payment_status = ?, paid_at = NOW(), paid_by = ?
       WHERE payout_id = ?`,
      [PaymentStatus.PAID, paidByUserId, payoutId],
    );

    await connection.commit();
    await delCache(FINANCE_DASHBOARD_CACHE_KEY);

    // Notify the employee
    const [users] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE citizen_id = ?',
      [payout.citizen_id],
    );

    if (users.length > 0) {
      const userId = (users[0] as any).id;
      await NotificationService.notifyUser(
        userId,
        'ค่าตอบแทนจ่ายแล้ว',
        `ค่าตอบแทน ${payout.period_month}/${payout.period_year} จำนวน ${payout.total_payable.toLocaleString()} บาท ได้จ่ายเรียบร้อยแล้ว`,
        '/dashboard/user/payments',
        'SUCCESS',
      );
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Batch mark payouts as paid
 */
export async function batchMarkAsPaid(
  payoutIds: number[],
  paidByUserId: number,
): Promise<{ success: number[]; failed: { id: number; reason: string }[] }> {
  const result: { success: number[]; failed: { id: number; reason: string }[] } = {
    success: [],
    failed: [],
  };

  for (const payoutId of payoutIds) {
    try {
      await markPayoutAsPaid(payoutId, paidByUserId);
      result.success.push(payoutId);
    } catch (error: any) {
      result.failed.push({ id: payoutId, reason: error.message });
    }
  }

  return result;
}

/**
 * Mark payout as cancelled
 */
export async function cancelPayout(
  payoutId: number,
  _cancelledByUserId: number,
  reason: string,
): Promise<void> {
  if (!reason || reason.trim() === '') {
    throw new Error('Cancellation reason is required');
  }

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const [payouts] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pay_results WHERE payout_id = ? FOR UPDATE',
      [payoutId],
    );

    if (payouts.length === 0) {
      throw new Error('Payout not found');
    }

    const payout = payouts[0] as any;

    if (payout.payment_status === PaymentStatus.PAID) {
      throw new Error('Cannot cancel a payout that is already paid');
    }

    await connection.execute(
      `UPDATE pay_results
       SET payment_status = ?, remark = CONCAT(IFNULL(remark, ''), '\n[ยกเลิก: ', ?, ']')
       WHERE payout_id = ?`,
      [PaymentStatus.CANCELLED, reason, payoutId],
    );

    await connection.commit();
    await delCache(FINANCE_DASHBOARD_CACHE_KEY);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get payouts for a specific period with filtering
 */
export async function getPayoutsByPeriod(
  periodId: number,
  status?: PaymentStatus,
  search?: string,
): Promise<PayoutWithDetails[]> {
  let sql = `
    SELECT po.*,
           p.period_month, p.period_year,
           COALESCE(e.first_name, s.first_name, '') AS first_name,
           COALESCE(e.last_name, s.last_name, '') AS last_name,
           COALESCE(e.department, s.department, '') AS department
    FROM pay_results po
    JOIN pay_periods p ON po.period_id = p.period_id
    LEFT JOIN emp_profiles e ON po.citizen_id = e.citizen_id
    LEFT JOIN emp_support_staff s ON po.citizen_id = s.citizen_id
    WHERE po.period_id = ?
  `;

  const params: any[] = [periodId];

  if (status) {
    sql += ' AND po.payment_status = ?';
    params.push(status);
  }

  if (search) {
    sql += ` AND (
      e.first_name LIKE ? OR e.last_name LIKE ? OR
      s.first_name LIKE ? OR s.last_name LIKE ? OR
      po.citizen_id LIKE ?
    )`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  sql += ' ORDER BY last_name, first_name';

  const rows = await query<RowDataPacket[]>(sql, params);

  return (rows as any[]).map((row) => ({
    payout_id: row.payout_id,
    period_id: row.period_id,
    period_month: row.period_month,
    period_year: row.period_year,
    citizen_id: row.citizen_id,
    employee_name: `${row.first_name} ${row.last_name}`.trim(),
    department: row.department,
    pts_rate_snapshot: row.pts_rate_snapshot,
    calculated_amount: row.calculated_amount,
    retroactive_amount: row.retroactive_amount || 0,
    total_payable: row.total_payable,
    payment_status: row.payment_status,
    paid_at: row.paid_at,
    paid_by: row.paid_by,
  }));
}

/**
 * Get finance summary by period (from view)
 */
export async function getFinanceSummary(
  year?: number,
  month?: number,
): Promise<FinanceSummary[]> {
  let sql = 'SELECT * FROM vw_finance_summary WHERE 1=1';
  const params: any[] = [];

  if (year) {
    sql += ' AND period_year = ?';
    params.push(year);
  }

  if (month) {
    sql += ' AND period_month = ?';
    params.push(month);
  }

  sql += ' ORDER BY period_year DESC, period_month DESC';

  const rows = await query<RowDataPacket[]>(sql, params);

  return (rows as any[]).map((row) => ({
    period_id: row.period_id,
    period_month: row.period_month,
    period_year: row.period_year,
    period_status: row.period_status,
    total_employees: row.total_employees || 0,
    total_amount: Number(row.total_amount) || 0,
    paid_amount: Number(row.paid_amount) || 0,
    pending_amount: Number(row.pending_amount) || 0,
    paid_count: row.paid_count || 0,
    pending_count: row.pending_count || 0,
  }));
}

/**
 * Get yearly summary
 */
export async function getYearlySummary(year?: number): Promise<YearlySummary[]> {
  let sql = 'SELECT * FROM vw_finance_yearly_summary';
  const params: any[] = [];

  if (year) {
    sql += ' WHERE period_year = ?';
    params.push(year);
  }

  sql += ' ORDER BY period_year DESC';

  const rows = await query<RowDataPacket[]>(sql, params);

  return (rows as any[]).map((row) => ({
    period_year: row.period_year,
    total_employees: row.total_employees || 0,
    total_amount: Number(row.total_amount) || 0,
    paid_amount: Number(row.paid_amount) || 0,
    pending_amount: Number(row.pending_amount) || 0,
  }));
}

/**
 * Get dashboard stats for finance overview
 */
export async function getFinanceDashboard(): Promise<{
  currentMonth: FinanceSummary | null;
  yearToDate: YearlySummary | null;
  recentPeriods: FinanceSummary[];
}> {
  const cached = await getJsonCache<{
    currentMonth: FinanceSummary | null;
    yearToDate: YearlySummary | null;
    recentPeriods: FinanceSummary[];
  }>(FINANCE_DASHBOARD_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Get current month summary
  const monthlySummary = await getFinanceSummary(currentYear, currentMonth);
  const currentMonthData = monthlySummary.length > 0 ? monthlySummary[0] : null;

  // Get year-to-date summary
  const yearlySummary = await getYearlySummary(currentYear);
  const yearToDateData = yearlySummary.length > 0 ? yearlySummary[0] : null;

  // Get last 6 periods
  const recentPeriods = await getFinanceSummary();

  const result = {
    currentMonth: currentMonthData,
    yearToDate: yearToDateData,
    recentPeriods: recentPeriods.slice(0, 6),
  };

  await setJsonCache(FINANCE_DASHBOARD_CACHE_KEY, result, 120);

  return result;
}

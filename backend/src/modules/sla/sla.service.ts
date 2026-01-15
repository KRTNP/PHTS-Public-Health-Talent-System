/**
 * PHTS System - SLA Reminder Service
 *
 * Handles business-day calculation and SLA reminders.
 * FR-06-04: Business-day SLA calculation
 * FR-06-05: Daily reminders for overdue requests
 */

import { RowDataPacket } from 'mysql2/promise';
import { query } from '../../config/database.js';
import { NotificationService } from '../notification/notification.service.js';
import { logAuditEvent, AuditEventType } from '../audit/audit.service.js';

/**
 * SLA configuration
 */
export interface SLAConfig {
  sla_id: number;
  step_no: number;
  role_name: string;
  sla_days: number;
  reminder_before_days: number;
  reminder_after_days: number;
  is_active: boolean;
}

/**
 * Request with SLA info
 */
export interface RequestSLAInfo {
  request_id: number;
  request_no: string;
  current_step: number;
  step_started_at: Date;
  assigned_officer_id: number | null;
  business_days_elapsed: number;
  sla_days: number;
  is_approaching_sla: boolean;
  is_overdue: boolean;
  days_until_sla: number;
  days_overdue: number;
  approver_ids: number[];
}

/**
 * Get all SLA configurations
 */
export async function getSLAConfigs(): Promise<SLAConfig[]> {
  const sql = `SELECT * FROM pts_sla_config WHERE is_active = 1 ORDER BY step_no`;
  const rows = await query<RowDataPacket[]>(sql);
  return rows as SLAConfig[];
}

/**
 * Get SLA config for a specific step
 */
export async function getSLAConfigForStep(stepNo: number): Promise<SLAConfig | null> {
  const sql = `SELECT * FROM pts_sla_config WHERE step_no = ? AND is_active = 1`;
  const rows = await query<RowDataPacket[]>(sql, [stepNo]);
  return rows.length > 0 ? (rows[0] as SLAConfig) : null;
}

/**
 * Update SLA configuration
 */
export async function updateSLAConfig(
  stepNo: number,
  slaDays: number,
  reminderBeforeDays?: number,
  reminderAfterDays?: number,
): Promise<void> {
  let sql = `UPDATE pts_sla_config SET sla_days = ?`;
  const params: any[] = [slaDays];

  if (reminderBeforeDays !== undefined) {
    sql += `, reminder_before_days = ?`;
    params.push(reminderBeforeDays);
  }

  if (reminderAfterDays !== undefined) {
    sql += `, reminder_after_days = ?`;
    params.push(reminderAfterDays);
  }

  sql += ` WHERE step_no = ?`;
  params.push(stepNo);

  await query(sql, params);
}

/**
 * Check if a date is a holiday or weekend
 */
export async function isHoliday(date: Date): Promise<boolean> {
  // Check weekend (Saturday = 6, Sunday = 0)
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return true;
  }

  // Check holiday table
  const dateStr = date.toISOString().split('T')[0];
  const sql = `SELECT COUNT(*) as count FROM holidays WHERE holiday_date = ?`;
  const rows = await query<RowDataPacket[]>(sql, [dateStr]);
  return (rows as any)[0]?.count > 0;
}

/**
 * Calculate business days between two dates
 */
export async function calculateBusinessDays(startDate: Date, endDate: Date): Promise<number> {
  let businessDays = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    const isHolidayDay = await isHoliday(current);
    if (!isHolidayDay) {
      businessDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return businessDays;
}

/**
 * Add business days to a date
 */
export async function addBusinessDays(startDate: Date, daysToAdd: number): Promise<Date> {
  const result = new Date(startDate);
  let addedDays = 0;

  while (addedDays < daysToAdd) {
    result.setDate(result.getDate() + 1);
    const isHolidayDay = await isHoliday(result);
    if (!isHolidayDay) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Get pending requests with SLA information
 */
export async function getPendingRequestsWithSLA(): Promise<RequestSLAInfo[]> {
  const sql = `
    SELECT r.request_id, r.request_no, r.current_step, r.step_started_at, r.assigned_officer_id,
           c.sla_days
    FROM pts_requests r
    LEFT JOIN pts_sla_config c ON r.current_step = c.step_no AND c.is_active = 1
    WHERE r.status = 'PENDING' AND r.step_started_at IS NOT NULL
    ORDER BY r.step_started_at ASC
  `;

  const rows = await query<RowDataPacket[]>(sql);
  const result: RequestSLAInfo[] = [];

  for (const row of rows as any[]) {
    const now = new Date();
    const stepStarted = new Date(row.step_started_at);
    const businessDaysElapsed = await calculateBusinessDays(stepStarted, now);
    const slaDays = row.sla_days || 3;

    const daysUntilSla = slaDays - businessDaysElapsed;
    const daysOverdue = businessDaysElapsed - slaDays;

    // Get approver IDs based on current step
    const approverIds = await getApproversForStep(row.current_step, row.assigned_officer_id);

    result.push({
      request_id: row.request_id,
      request_no: row.request_no,
      current_step: row.current_step,
      step_started_at: stepStarted,
      assigned_officer_id: row.assigned_officer_id,
      business_days_elapsed: businessDaysElapsed,
      sla_days: slaDays,
      is_approaching_sla: daysUntilSla > 0 && daysUntilSla <= 1,
      is_overdue: businessDaysElapsed > slaDays,
      days_until_sla: Math.max(0, daysUntilSla),
      days_overdue: Math.max(0, daysOverdue),
      approver_ids: approverIds,
    });
  }

  return result;
}

/**
 * Get approvers for a step (simplified - in real implementation would use scope resolution)
 */
async function getApproversForStep(
  stepNo: number,
  assignedOfficerId: number | null,
): Promise<number[]> {
  const roleMap: Record<number, string> = {
    1: 'HEAD_WARD',
    2: 'HEAD_DEPT',
    3: 'PTS_OFFICER',
    4: 'HEAD_HR',
    5: 'HEAD_FINANCE',
    6: 'DIRECTOR',
  };

  const role = roleMap[stepNo];
  if (!role) return [];

  // For PTS_OFFICER step, if assigned, return only assigned officer
  if (stepNo === 3 && assignedOfficerId) {
    return [assignedOfficerId];
  }

  const sql = `SELECT id FROM users WHERE role = ? AND is_active = 1`;
  const rows = await query<RowDataPacket[]>(sql, [role]);
  return (rows as any[]).map((r) => r.id);
}

/**
 * Check if reminder was already sent today
 */
async function wasReminderSentToday(
  requestId: number,
  stepNo: number,
  reminderType: string,
): Promise<boolean> {
  const sql = `
    SELECT COUNT(*) as count
    FROM pts_sla_reminders
    WHERE request_id = ? AND step_no = ? AND reminder_type = ?
      AND DATE(sent_at) = CURDATE()
  `;

  const rows = await query<RowDataPacket[]>(sql, [requestId, stepNo, reminderType]);
  return (rows as any)[0]?.count > 0;
}

/**
 * Log reminder sent
 */
async function logReminderSent(
  requestId: number,
  stepNo: number,
  targetUserId: number,
  reminderType: 'APPROACHING' | 'OVERDUE' | 'DAILY_OVERDUE',
  sentVia: 'IN_APP' | 'EMAIL' | 'BOTH' = 'IN_APP',
): Promise<void> {
  const sql = `
    INSERT INTO pts_sla_reminders (request_id, step_no, target_user_id, reminder_type, sent_via)
    VALUES (?, ?, ?, ?, ?)
  `;

  await query(sql, [requestId, stepNo, targetUserId, reminderType, sentVia]);
}

/**
 * Send SLA reminders for approaching and overdue requests
 */
export async function sendSLAReminders(): Promise<{
  approaching: number;
  overdue: number;
  errors: string[];
}> {
  const result = { approaching: 0, overdue: 0, errors: [] as string[] };

  try {
    const requests = await getPendingRequestsWithSLA();

    for (const req of requests) {
      try {
        // Handle approaching SLA
        if (req.is_approaching_sla) {
          const alreadySent = await wasReminderSentToday(
            req.request_id,
            req.current_step,
            'APPROACHING',
          );

          if (!alreadySent) {
            for (const userId of req.approver_ids) {
              await NotificationService.notifyUser(
                userId,
                'คำขอใกล้ครบกำหนด SLA',
                `คำขอเลขที่ ${req.request_no} จะครบกำหนด SLA ใน ${req.days_until_sla} วันทำการ`,
                `/dashboard/officer/requests/${req.request_id}`,
                'WARNING',
              );
              // Email notifications are intentionally disabled until SMTP is configured.
              // When ready, wire EmailService.sendEmail(...) with a real recipient address.

              await logReminderSent(req.request_id, req.current_step, userId, 'APPROACHING');
            }
            result.approaching++;
          }
        }

        // Handle overdue requests
        if (req.is_overdue) {
          const alreadySent = await wasReminderSentToday(
            req.request_id,
            req.current_step,
            'DAILY_OVERDUE',
          );

          if (!alreadySent) {
            for (const userId of req.approver_ids) {
              await NotificationService.notifyUser(
                userId,
                'คำขอเกินกำหนด SLA',
                `คำขอเลขที่ ${req.request_no} เกินกำหนด SLA แล้ว ${req.days_overdue} วันทำการ กรุณาดำเนินการ`,
                `/dashboard/officer/requests/${req.request_id}`,
                'ERROR',
              );
              // Email notifications are intentionally disabled until SMTP is configured.

              await logReminderSent(req.request_id, req.current_step, userId, 'DAILY_OVERDUE');
            }
            result.overdue++;
          }
        }
      } catch (error: any) {
        result.errors.push(`Request ${req.request_id}: ${error.message}`);
      }
    }

    // Log the reminder job run
    await logAuditEvent({
      eventType: AuditEventType.OTHER,
      entityType: 'sla_reminders',
      actionDetail: {
        action: 'SLA_REMINDER_JOB',
        approaching_count: result.approaching,
        overdue_count: result.overdue,
        errors: result.errors,
        run_at: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    result.errors.push(`Job error: ${error.message}`);
  }

  return result;
}

/**
 * Get SLA report for dashboard
 */
export async function getSLAReport(): Promise<{
  totalPending: number;
  withinSLA: number;
  approachingSLA: number;
  overdueSLA: number;
  byStep: { step: number; role: string; count: number; overdue: number }[];
}> {
  const requests = await getPendingRequestsWithSLA();

  const byStep: Record<number, { count: number; overdue: number }> = {};

  let withinSLA = 0;
  let approachingSLA = 0;
  let overdueSLA = 0;

  for (const req of requests) {
    // Count by step
    if (!byStep[req.current_step]) {
      byStep[req.current_step] = { count: 0, overdue: 0 };
    }
    byStep[req.current_step].count++;
    if (req.is_overdue) {
      byStep[req.current_step].overdue++;
      overdueSLA++;
    } else if (req.is_approaching_sla) {
      approachingSLA++;
    } else {
      withinSLA++;
    }
  }

  const roleMap: Record<number, string> = {
    1: 'HEAD_WARD',
    2: 'HEAD_DEPT',
    3: 'PTS_OFFICER',
    4: 'HEAD_HR',
    5: 'HEAD_FINANCE',
    6: 'DIRECTOR',
  };

  const byStepArray = Object.entries(byStep).map(([step, data]) => ({
    step: parseInt(step, 10),
    role: roleMap[parseInt(step, 10)] || 'UNKNOWN',
    count: data.count,
    overdue: data.overdue,
  }));

  return {
    totalPending: requests.length,
    withinSLA,
    approachingSLA,
    overdueSLA,
    byStep: byStepArray.sort((a, b) => a.step - b.step),
  };
}

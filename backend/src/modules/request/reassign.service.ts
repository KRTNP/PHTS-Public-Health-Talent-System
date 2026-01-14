/**
 * PHTS System - Request Reassignment Service
 *
 * Handles transfer of pending requests between PTS_OFFICER users.
 * Only requests at step 3 (PTS_OFFICER) can be reassigned.
 */

import { RowDataPacket } from 'mysql2/promise';
import { query, getConnection } from '../../config/database.js';
import { RequestStatus, ROLE_STEP_MAP } from './request.types.js';
import { NotificationService } from '../notification/notification.service.js';
import { UserRole } from '../../types/auth.js';

/**
 * DTO for reassign operation
 */
export interface ReassignRequestDTO {
  targetOfficerId: number;
  reason: string;
}

/**
 * Result of reassign operation
 */
export interface ReassignResult {
  requestId: number;
  fromOfficerId: number;
  toOfficerId: number;
  reason: string;
  reassignedAt: Date;
}

/**
 * Get list of PTS_OFFICER users available for reassignment
 */
export async function getAvailableOfficers(
  excludeUserId?: number,
): Promise<{ id: number; name: string; citizen_id: string }[]> {
  let sql = `
    SELECT u.id, u.citizen_id,
           COALESCE(e.first_name, s.first_name, '') AS first_name,
           COALESCE(e.last_name, s.last_name, '') AS last_name
    FROM users u
    LEFT JOIN pts_employees e ON u.citizen_id = e.citizen_id
    LEFT JOIN pts_support_employees s ON u.citizen_id = s.citizen_id
    WHERE u.role = ? AND u.is_active = 1
  `;

  const params: any[] = [UserRole.PTS_OFFICER];

  if (excludeUserId) {
    sql += ' AND u.id != ?';
    params.push(excludeUserId);
  }

  sql += ' ORDER BY first_name, last_name';

  const rows = await query<RowDataPacket[]>(sql, params);

  return (rows as any[]).map((row) => ({
    id: row.id,
    citizen_id: row.citizen_id,
    name: `${row.first_name} ${row.last_name}`.trim() || row.citizen_id,
  }));
}

/**
 * Reassign a request to another PTS_OFFICER
 *
 * Rules:
 * - Only PTS_OFFICER can reassign
 * - Only requests at step 3 (PTS_OFFICER) can be reassigned
 * - Target must be an active PTS_OFFICER
 * - Reason is required
 */
export async function reassignRequest(
  requestId: number,
  fromOfficerId: number,
  dto: ReassignRequestDTO,
): Promise<ReassignResult> {
  const { targetOfficerId, reason } = dto;

  if (!reason || reason.trim() === '') {
    throw new Error('Reason for reassignment is required');
  }

  if (fromOfficerId === targetOfficerId) {
    throw new Error('Cannot reassign to yourself');
  }

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // 1) Verify request exists and is at step 3 (PTS_OFFICER)
    const [requests] = await connection.query<RowDataPacket[]>(
      `SELECT r.*, r.assigned_officer_id
       FROM pts_requests r
       WHERE r.request_id = ? FOR UPDATE`,
      [requestId],
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = requests[0] as any;

    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot reassign request with status: ${request.status}`);
    }

    const ptsOfficerStep = ROLE_STEP_MAP['PTS_OFFICER']; // Step 3
    if (request.current_step !== ptsOfficerStep) {
      throw new Error(
        `Request is not at PTS_OFFICER step. Current step: ${request.current_step}`,
      );
    }

    // 2) Verify target officer exists and is active PTS_OFFICER
    const [targetUsers] = await connection.query<RowDataPacket[]>(
      'SELECT id, role, is_active FROM users WHERE id = ?',
      [targetOfficerId],
    );

    if (targetUsers.length === 0) {
      throw new Error('Target officer not found');
    }

    const targetUser = targetUsers[0] as any;

    if (targetUser.role !== UserRole.PTS_OFFICER) {
      throw new Error('Target user is not a PTS_OFFICER');
    }

    if (!targetUser.is_active) {
      throw new Error('Target officer is not active');
    }

    // 3) Update the assigned_officer_id
    await connection.execute(
      `UPDATE pts_requests
       SET assigned_officer_id = ?, updated_at = NOW()
       WHERE request_id = ?`,
      [targetOfficerId, requestId],
    );

    // 4) Log the reassign action
    await connection.execute(
      `INSERT INTO pts_request_actions
       (request_id, actor_id, step_no, action, comment)
       VALUES (?, ?, ?, 'REASSIGN', ?)`,
      [requestId, fromOfficerId, ptsOfficerStep, reason],
    );

    await connection.commit();

    // 5) Notify the target officer
    await NotificationService.notifyUser(
      targetOfficerId,
      'มีคำขอโอนมาให้ท่าน',
      `คำขอเลขที่ ${request.request_no} ถูกโอนมาให้ท่านดำเนินการ: ${reason}`,
      `/dashboard/officer/requests/${requestId}`,
      'INFO',
    );

    return {
      requestId,
      fromOfficerId,
      toOfficerId: targetOfficerId,
      reason,
      reassignedAt: new Date(),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get pending requests for a specific PTS_OFFICER
 *
 * Returns requests that are:
 * - At step 3 (PTS_OFFICER step)
 * - Either assigned to this officer OR not assigned to anyone (legacy/new)
 */
export async function getPendingForOfficer(
  officerId: number,
): Promise<any[]> {
  const ptsOfficerStep = ROLE_STEP_MAP['PTS_OFFICER'];

  const sql = `
    SELECT r.*, u.citizen_id AS requester_citizen_id, u.role AS requester_role,
           COALESCE(e.first_name, s.first_name) AS req_first_name,
           COALESCE(e.last_name, s.last_name) AS req_last_name,
           COALESCE(e.position_name, s.position_name) AS req_position
    FROM pts_requests r
    JOIN users u ON r.user_id = u.id
    LEFT JOIN pts_employees e ON u.citizen_id = e.citizen_id
    LEFT JOIN pts_support_employees s ON u.citizen_id = s.citizen_id
    WHERE r.status = ?
      AND r.current_step = ?
      AND (r.assigned_officer_id IS NULL OR r.assigned_officer_id = ?)
    ORDER BY r.created_at ASC
  `;

  const rows = await query<RowDataPacket[]>(sql, [
    RequestStatus.PENDING,
    ptsOfficerStep,
    officerId,
  ]);

  return rows as any[];
}

/**
 * Get reassignment history for a request
 */
export async function getReassignmentHistory(
  requestId: number,
): Promise<any[]> {
  const sql = `
    SELECT a.action_id, a.actor_id, a.step_no, a.comment AS reason, a.created_at,
           u.citizen_id AS actor_citizen_id,
           COALESCE(e.first_name, s.first_name, '') AS actor_first_name,
           COALESCE(e.last_name, s.last_name, '') AS actor_last_name
    FROM pts_request_actions a
    JOIN users u ON a.actor_id = u.id
    LEFT JOIN pts_employees e ON u.citizen_id = e.citizen_id
    LEFT JOIN pts_support_employees s ON u.citizen_id = s.citizen_id
    WHERE a.request_id = ? AND a.action = 'REASSIGN'
    ORDER BY a.created_at DESC
  `;

  const rows = await query<RowDataPacket[]>(sql, [requestId]);

  return (rows as any[]).map((row) => ({
    actionId: row.action_id,
    actorId: row.actor_id,
    actorName: `${row.actor_first_name} ${row.actor_last_name}`.trim(),
    reason: row.reason,
    reassignedAt: row.created_at,
  }));
}

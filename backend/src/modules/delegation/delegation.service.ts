/**
 * PHTS System - Delegation Service
 *
 * Handles temporary role delegation (acting role).
 * FR-10-01: Time-bound delegation of approval authority
 * FR-10-02: Auto-expiration at end of delegation period
 */

import { RowDataPacket } from 'mysql2/promise';
import { query, getConnection } from '../../config/database.js';
import { NotificationService } from '../notification/notification.service.js';
import { logAuditEvent, AuditEventType } from '../audit/audit.service.js';

/**
 * Delegation status
 */
export enum DelegationStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

/**
 * Scope type for delegation
 */
export enum DelegationScopeType {
  ALL = 'ALL',
  DEPARTMENT = 'DEPARTMENT',
  SUB_DEPARTMENT = 'SUB_DEPARTMENT',
}

/**
 * Delegation record
 */
export interface Delegation {
  delegation_id: number;
  delegator_id: number;
  delegator_name: string;
  delegate_id: number;
  delegate_name: string;
  delegated_role: string;
  scope_type: DelegationScopeType;
  scope_value: string | null;
  start_date: Date;
  end_date: Date;
  reason: string | null;
  status: DelegationStatus;
  cancelled_at: Date | null;
  cancelled_by: number | null;
  created_at: Date;
}

/**
 * DTO for creating delegation
 */
export interface CreateDelegationDTO {
  delegateId: number;
  delegatedRole: string;
  scopeType?: DelegationScopeType;
  scopeValue?: string;
  startDate: Date | string;
  endDate: Date | string;
  reason?: string;
}

/**
 * Get all delegations for a user (as delegator or delegate)
 */
export async function getUserDelegations(
  userId: number,
  includeExpired: boolean = false,
): Promise<Delegation[]> {
  let sql = `
    SELECT d.*,
           COALESCE(e1.first_name, s1.first_name, '') AS delegator_first_name,
           COALESCE(e1.last_name, s1.last_name, '') AS delegator_last_name,
           COALESCE(e2.first_name, s2.first_name, '') AS delegate_first_name,
           COALESCE(e2.last_name, s2.last_name, '') AS delegate_last_name
    FROM wf_delegations d
    JOIN users u1 ON d.delegator_id = u1.id
    JOIN users u2 ON d.delegate_id = u2.id
    LEFT JOIN emp_profiles e1 ON u1.citizen_id = e1.citizen_id
    LEFT JOIN emp_support_staff s1 ON u1.citizen_id = s1.citizen_id
    LEFT JOIN emp_profiles e2 ON u2.citizen_id = e2.citizen_id
    LEFT JOIN emp_support_staff s2 ON u2.citizen_id = s2.citizen_id
    WHERE (d.delegator_id = ? OR d.delegate_id = ?)
  `;

  const params: any[] = [userId, userId];

  if (!includeExpired) {
    sql += ` AND d.status = 'ACTIVE'`;
  }

  sql += ' ORDER BY d.start_date DESC';

  const rows = await query<RowDataPacket[]>(sql, params);

  return (rows as any[]).map((row) => ({
    delegation_id: row.delegation_id,
    delegator_id: row.delegator_id,
    delegator_name: `${row.delegator_first_name} ${row.delegator_last_name}`.trim(),
    delegate_id: row.delegate_id,
    delegate_name: `${row.delegate_first_name} ${row.delegate_last_name}`.trim(),
    delegated_role: row.delegated_role,
    scope_type: row.scope_type,
    scope_value: row.scope_value,
    start_date: row.start_date,
    end_date: row.end_date,
    reason: row.reason,
    status: row.status,
    cancelled_at: row.cancelled_at,
    cancelled_by: row.cancelled_by,
    created_at: row.created_at,
  }));
}

/**
 * Get active delegations where user is the delegate
 */
export async function getActiveDelegationsForDelegate(
  delegateId: number,
): Promise<Delegation[]> {
  const sql = `
    SELECT d.*,
           COALESCE(e1.first_name, s1.first_name, '') AS delegator_first_name,
           COALESCE(e1.last_name, s1.last_name, '') AS delegator_last_name,
           COALESCE(e2.first_name, s2.first_name, '') AS delegate_first_name,
           COALESCE(e2.last_name, s2.last_name, '') AS delegate_last_name
    FROM wf_delegations d
    JOIN users u1 ON d.delegator_id = u1.id
    JOIN users u2 ON d.delegate_id = u2.id
    LEFT JOIN emp_profiles e1 ON u1.citizen_id = e1.citizen_id
    LEFT JOIN emp_support_staff s1 ON u1.citizen_id = s1.citizen_id
    LEFT JOIN emp_profiles e2 ON u2.citizen_id = e2.citizen_id
    LEFT JOIN emp_support_staff s2 ON u2.citizen_id = s2.citizen_id
    WHERE d.delegate_id = ?
      AND d.status = 'ACTIVE'
      AND CURDATE() BETWEEN d.start_date AND d.end_date
    ORDER BY d.delegated_role
  `;

  const rows = await query<RowDataPacket[]>(sql, [delegateId]);

  return (rows as any[]).map((row) => ({
    delegation_id: row.delegation_id,
    delegator_id: row.delegator_id,
    delegator_name: `${row.delegator_first_name} ${row.delegator_last_name}`.trim(),
    delegate_id: row.delegate_id,
    delegate_name: `${row.delegate_first_name} ${row.delegate_last_name}`.trim(),
    delegated_role: row.delegated_role,
    scope_type: row.scope_type,
    scope_value: row.scope_value,
    start_date: row.start_date,
    end_date: row.end_date,
    reason: row.reason,
    status: row.status,
    cancelled_at: row.cancelled_at,
    cancelled_by: row.cancelled_by,
    created_at: row.created_at,
  }));
}

/**
 * Check if a user can act as a specific role (through delegation)
 */
export async function canActAsRole(
  userId: number,
  role: string,
  scopeType?: DelegationScopeType,
  scopeValue?: string,
): Promise<{ canAct: boolean; delegationId: number | null; delegatorId: number | null }> {
  let sql = `
    SELECT delegation_id, delegator_id
    FROM wf_delegations
    WHERE delegate_id = ?
      AND delegated_role = ?
      AND status = 'ACTIVE'
      AND CURDATE() BETWEEN start_date AND end_date
  `;

  const params: any[] = [userId, role];

  // Check scope if specified
  if (scopeType && scopeValue) {
    sql += ` AND (scope_type = 'ALL' OR (scope_type = ? AND scope_value = ?))`;
    params.push(scopeType, scopeValue);
  }

  sql += ' LIMIT 1';

  const rows = await query<RowDataPacket[]>(sql, params);

  if (rows.length > 0) {
    const row = rows[0] as any;
    return {
      canAct: true,
      delegationId: row.delegation_id,
      delegatorId: row.delegator_id,
    };
  }

  return { canAct: false, delegationId: null, delegatorId: null };
}

/**
 * Create a new delegation
 */
export async function createDelegation(
  delegatorId: number,
  dto: CreateDelegationDTO,
): Promise<Delegation> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Validate delegate exists and is active
    const [delegates] = await connection.query<RowDataPacket[]>(
      'SELECT id, role FROM users WHERE id = ? AND is_active = 1',
      [dto.delegateId],
    );

    if (delegates.length === 0) {
      throw new Error('Delegate user not found or inactive');
    }

    // Validate delegator has the role they're delegating
    const [delegators] = await connection.query<RowDataPacket[]>(
      'SELECT role FROM users WHERE id = ?',
      [delegatorId],
    );

    if (delegators.length === 0) {
      throw new Error('Delegator not found');
    }

    const delegatorRole = (delegators[0] as any).role;
    if (delegatorRole !== dto.delegatedRole && delegatorRole !== 'ADMIN') {
      throw new Error('Cannot delegate a role you do not have');
    }

    // Check for overlapping delegations
    const [existing] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM wf_delegations
       WHERE delegator_id = ? AND delegate_id = ? AND delegated_role = ?
         AND status = 'ACTIVE'
         AND NOT (end_date < ? OR start_date > ?)`,
      [delegatorId, dto.delegateId, dto.delegatedRole, dto.startDate, dto.endDate],
    );

    if (existing.length > 0) {
      throw new Error('Overlapping delegation already exists');
    }

    // Create delegation
    const [result] = await connection.execute(
      `INSERT INTO wf_delegations
       (delegator_id, delegate_id, delegated_role, scope_type, scope_value,
        start_date, end_date, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        delegatorId,
        dto.delegateId,
        dto.delegatedRole,
        dto.scopeType || DelegationScopeType.ALL,
        dto.scopeValue || null,
        dto.startDate,
        dto.endDate,
        dto.reason || null,
      ],
    );

    const delegationId = (result as any).insertId;

    await connection.commit();

    // Log audit
    await logAuditEvent({
      eventType: AuditEventType.DELEGATION_CREATE,
      entityType: 'delegation',
      entityId: delegationId,
      actorId: delegatorId,
      actionDetail: {
        delegate_id: dto.delegateId,
        delegated_role: dto.delegatedRole,
        start_date: dto.startDate,
        end_date: dto.endDate,
      },
    });

    // Notify delegate
    await NotificationService.notifyUser(
      dto.delegateId,
      'มอบหมายสิทธิ์ใหม่',
      `ท่านได้รับมอบหมายสิทธิ์ ${dto.delegatedRole} ตั้งแต่ ${dto.startDate} ถึง ${dto.endDate}`,
      '/dashboard/user/delegations',
      'INFO',
    );

    // Return created delegation
    const delegations = await getUserDelegations(delegatorId, true);
    return delegations.find((d) => d.delegation_id === delegationId)!;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Cancel a delegation
 */
export async function cancelDelegation(
  delegationId: number,
  cancelledBy: number,
  reason?: string,
): Promise<void> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Get delegation
    const [delegations] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM wf_delegations WHERE delegation_id = ? FOR UPDATE',
      [delegationId],
    );

    if (delegations.length === 0) {
      throw new Error('Delegation not found');
    }

    const delegation = delegations[0] as any;

    // Only delegator, delegate, or ADMIN can cancel
    const [users] = await connection.query<RowDataPacket[]>(
      'SELECT role FROM users WHERE id = ?',
      [cancelledBy],
    );

    const canceller = users[0] as any;
    const canCancel =
      cancelledBy === delegation.delegator_id ||
      cancelledBy === delegation.delegate_id ||
      canceller.role === 'ADMIN';

    if (!canCancel) {
      throw new Error('Not authorized to cancel this delegation');
    }

    if (delegation.status !== DelegationStatus.ACTIVE) {
      throw new Error('Delegation is not active');
    }

    // Cancel delegation
    await connection.execute(
      `UPDATE wf_delegations
       SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_by = ?
       WHERE delegation_id = ?`,
      [cancelledBy, delegationId],
    );

    await connection.commit();

    // Log audit
    await logAuditEvent({
      eventType: AuditEventType.DELEGATION_END,
      entityType: 'delegation',
      entityId: delegationId,
      actorId: cancelledBy,
      actionDetail: {
        reason: reason || 'cancelled',
        previous_end_date: delegation.end_date,
      },
    });

    // Notify delegate
    await NotificationService.notifyUser(
      delegation.delegate_id,
      'การมอบหมายสิทธิ์ถูกยกเลิก',
      `การมอบหมายสิทธิ์ ${delegation.delegated_role} ถูกยกเลิกแล้ว`,
      '/dashboard/user/delegations',
      'WARNING',
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Expire delegations that have passed their end date
 * This should be run as a scheduled job
 */
export async function expireOldDelegations(): Promise<number> {
  const sql = `
    UPDATE wf_delegations
    SET status = 'EXPIRED'
    WHERE status = 'ACTIVE' AND end_date < CURDATE()
  `;

  const result = await query(sql);
  const affectedRows = (result as any).affectedRows;

  if (affectedRows > 0) {
    await logAuditEvent({
      eventType: AuditEventType.OTHER,
      entityType: 'delegation',
      actionDetail: {
        action: 'EXPIRE_DELEGATIONS',
        expired_count: affectedRows,
      },
    });
  }

  return affectedRows;
}

/**
 * Get all active delegations (for admin view)
 */
export async function getAllActiveDelegations(): Promise<Delegation[]> {
  const sql = `
    SELECT d.*,
           COALESCE(e1.first_name, s1.first_name, '') AS delegator_first_name,
           COALESCE(e1.last_name, s1.last_name, '') AS delegator_last_name,
           COALESCE(e2.first_name, s2.first_name, '') AS delegate_first_name,
           COALESCE(e2.last_name, s2.last_name, '') AS delegate_last_name
    FROM wf_delegations d
    JOIN users u1 ON d.delegator_id = u1.id
    JOIN users u2 ON d.delegate_id = u2.id
    LEFT JOIN emp_profiles e1 ON u1.citizen_id = e1.citizen_id
    LEFT JOIN emp_support_staff s1 ON u1.citizen_id = s1.citizen_id
    LEFT JOIN emp_profiles e2 ON u2.citizen_id = e2.citizen_id
    LEFT JOIN emp_support_staff s2 ON u2.citizen_id = s2.citizen_id
    WHERE d.status = 'ACTIVE'
      AND CURDATE() BETWEEN d.start_date AND d.end_date
    ORDER BY d.delegated_role, d.start_date
  `;

  const rows = await query<RowDataPacket[]>(sql);

  return (rows as any[]).map((row) => ({
    delegation_id: row.delegation_id,
    delegator_id: row.delegator_id,
    delegator_name: `${row.delegator_first_name} ${row.delegator_last_name}`.trim(),
    delegate_id: row.delegate_id,
    delegate_name: `${row.delegate_first_name} ${row.delegate_last_name}`.trim(),
    delegated_role: row.delegated_role,
    scope_type: row.scope_type,
    scope_value: row.scope_value,
    start_date: row.start_date,
    end_date: row.end_date,
    reason: row.reason,
    status: row.status,
    cancelled_at: row.cancelled_at,
    cancelled_by: row.cancelled_by,
    created_at: row.created_at,
  }));
}

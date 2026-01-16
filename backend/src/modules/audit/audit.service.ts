/**
 * PHTS System - Audit Trail Service
 *
 * Handles audit event logging, search, and export.
 * FR-09-01: Log audit trail for approvals and important data changes
 * FR-09-02: Search and export audit reports
 */

import { RowDataPacket } from 'mysql2/promise';
import { query } from '../../config/database.js';

/**
 * Audit event types
 */
export enum AuditEventType {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',

  // Request workflow
  REQUEST_CREATE = 'REQUEST_CREATE',
  REQUEST_APPROVE = 'REQUEST_APPROVE',
  REQUEST_REJECT = 'REQUEST_REJECT',
  REQUEST_RETURN = 'REQUEST_RETURN',
  REQUEST_REASSIGN = 'REQUEST_REASSIGN',

  // Period workflow
  PERIOD_CREATE = 'PERIOD_CREATE',
  PERIOD_APPROVE = 'PERIOD_APPROVE',
  PERIOD_CLOSE = 'PERIOD_CLOSE',
  PERIOD_FREEZE = 'PERIOD_FREEZE',

  // Finance
  PAYOUT_MARK_PAID = 'PAYOUT_MARK_PAID',
  PAYOUT_CANCEL = 'PAYOUT_CANCEL',

  // User management
  USER_CREATE = 'USER_CREATE',
  USER_UPDATE = 'USER_UPDATE',
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
  USER_DISABLE = 'USER_DISABLE',

  // Master data
  MASTER_RATE_UPDATE = 'MASTER_RATE_UPDATE',
  HOLIDAY_UPDATE = 'HOLIDAY_UPDATE',

  // Delegation
  DELEGATION_CREATE = 'DELEGATION_CREATE',
  DELEGATION_END = 'DELEGATION_END',

  // Snapshot
  SNAPSHOT_FREEZE = 'SNAPSHOT_FREEZE',
  SNAPSHOT_UNFREEZE = 'SNAPSHOT_UNFREEZE',

  // System
  DATA_SYNC = 'DATA_SYNC',
  DATA_EXPORT = 'DATA_EXPORT',

  // Access review
  ACCESS_REVIEW_CREATE = 'ACCESS_REVIEW_CREATE',
  ACCESS_REVIEW_COMPLETE = 'ACCESS_REVIEW_COMPLETE',

  // Other
  OTHER = 'OTHER',
}

/**
 * Audit event input DTO
 */
export interface CreateAuditEventDTO {
  eventType: AuditEventType;
  entityType: string;
  entityId?: number | null;
  actorId?: number | null;
  actorRole?: string | null;
  actionDetail?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Audit event record
 */
export interface AuditEvent {
  audit_id: number;
  event_type: AuditEventType;
  entity_type: string;
  entity_id: number | null;
  actor_id: number | null;
  actor_role: string | null;
  action_detail: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  actor_name?: string | null;
}

/**
 * Search filter for audit events
 */
export interface AuditSearchFilter {
  eventType?: AuditEventType | AuditEventType[];
  entityType?: string;
  entityId?: number;
  actorId?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(dto: CreateAuditEventDTO): Promise<number> {
  const sql = `
    INSERT INTO pts_audit_events
    (event_type, entity_type, entity_id, actor_id, actor_role, action_detail, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const result = await query(sql, [
    dto.eventType,
    dto.entityType,
    dto.entityId || null,
    dto.actorId || null,
    dto.actorRole || null,
    dto.actionDetail ? JSON.stringify(dto.actionDetail) : null,
    dto.ipAddress || null,
    dto.userAgent || null,
  ]);

  return (result as any).insertId;
}

/**
 * Search audit events with filters
 */
export async function searchAuditEvents(
  filter: AuditSearchFilter,
): Promise<{ events: AuditEvent[]; total: number; page: number; limit: number }> {
  const page = filter.page || 1;
  const limit = Math.min(filter.limit || 50, 500);
  const offset = (page - 1) * limit;

  let whereClauses: string[] = ['1=1'];
  const params: any[] = [];

  // Event type filter
  if (filter.eventType) {
    if (Array.isArray(filter.eventType)) {
      whereClauses.push(`a.event_type IN (${filter.eventType.map(() => '?').join(',')})`);
      params.push(...filter.eventType);
    } else {
      whereClauses.push('a.event_type = ?');
      params.push(filter.eventType);
    }
  }

  // Entity filters
  if (filter.entityType) {
    whereClauses.push('a.entity_type = ?');
    params.push(filter.entityType);
  }

  if (filter.entityId) {
    whereClauses.push('a.entity_id = ?');
    params.push(filter.entityId);
  }

  // Actor filter
  if (filter.actorId) {
    whereClauses.push('a.actor_id = ?');
    params.push(filter.actorId);
  }

  // Date range
  if (filter.startDate) {
    whereClauses.push('a.created_at >= ?');
    params.push(filter.startDate);
  }

  if (filter.endDate) {
    whereClauses.push('a.created_at <= ?');
    params.push(filter.endDate);
  }

  // Text search (in action_detail JSON)
  if (filter.search) {
    whereClauses.push('(a.action_detail LIKE ? OR a.entity_type LIKE ?)');
    const searchPattern = `%${filter.search}%`;
    params.push(searchPattern, searchPattern);
  }

  const whereClause = whereClauses.join(' AND ');

  // Count total
  const countSql = `SELECT COUNT(*) as total FROM pts_audit_events a WHERE ${whereClause}`;
  const countResult = await query<RowDataPacket[]>(countSql, params);
  const total = (countResult as any)[0]?.total || 0;

  // Get events with actor name
  // Note: Using template literals for LIMIT/OFFSET to avoid mysql2 prepared statement issues
  const sql = `
    SELECT a.*,
           COALESCE(e.first_name, s.first_name, '') AS actor_first_name,
           COALESCE(e.last_name, s.last_name, '') AS actor_last_name
    FROM pts_audit_events a
    LEFT JOIN users u ON a.actor_id = u.id
    LEFT JOIN pts_employees e ON u.citizen_id = e.citizen_id
    LEFT JOIN pts_support_employees s ON u.citizen_id = s.citizen_id
    WHERE ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rows = await query<RowDataPacket[]>(sql, params);

  const events: AuditEvent[] = (rows as any[]).map((row) => ({
    audit_id: row.audit_id,
    event_type: row.event_type,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    actor_id: row.actor_id,
    actor_role: row.actor_role,
    action_detail: row.action_detail
      ? typeof row.action_detail === 'string'
        ? JSON.parse(row.action_detail)
        : row.action_detail
      : null,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at,
    actor_name: `${row.actor_first_name} ${row.actor_last_name}`.trim() || null,
  }));

  return { events, total, page, limit };
}

/**
 * Get audit events for a specific entity
 */
export async function getEntityAuditTrail(
  entityType: string,
  entityId: number,
): Promise<AuditEvent[]> {
  const result = await searchAuditEvents({
    entityType,
    entityId,
    limit: 100,
  });

  return result.events;
}

/**
 * Get audit events for export (returns all matching records)
 */
export async function getAuditEventsForExport(
  filter: Omit<AuditSearchFilter, 'page' | 'limit'>,
): Promise<AuditEvent[]> {
  // Use a large limit for export
  const result = await searchAuditEvents({
    ...filter,
    page: 1,
    limit: 10000,
  });

  return result.events;
}

/**
 * Get audit summary by event type for a date range
 */
export async function getAuditSummary(
  startDate?: Date | string,
  endDate?: Date | string,
): Promise<{ event_type: string; count: number }[]> {
  let sql = `
    SELECT event_type, COUNT(*) as count
    FROM pts_audit_events
    WHERE 1=1
  `;

  const params: any[] = [];

  if (startDate) {
    sql += ' AND created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    sql += ' AND created_at <= ?';
    params.push(endDate);
  }

  sql += ' GROUP BY event_type ORDER BY count DESC';

  const rows = await query<RowDataPacket[]>(sql, params);

  return (rows as any[]).map((row) => ({
    event_type: row.event_type,
    count: row.count,
  }));
}

/**
 * Helper to create audit event from Express request
 */
export function extractRequestInfo(req: any): { ipAddress: string; userAgent: string } {
  const ipAddress =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.ip ||
    'unknown';

  const userAgent = req.headers['user-agent'] || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Convenience function to log with request context
 */
export async function logAuditEventWithRequest(
  req: any,
  dto: Omit<CreateAuditEventDTO, 'ipAddress' | 'userAgent' | 'actorId' | 'actorRole'>,
): Promise<number> {
  const { ipAddress, userAgent } = extractRequestInfo(req);
  const user = req.user as any;

  return logAuditEvent({
    ...dto,
    actorId: user?.id || null,
    actorRole: user?.role || null,
    ipAddress,
    userAgent,
  });
}

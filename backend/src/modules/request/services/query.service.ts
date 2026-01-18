/**
 * Request Module - Query Service
 *
 * Read operations for request data
 */

import { RowDataPacket } from 'mysql2/promise';
import { query } from '../../../config/database.js';
import {
  RequestStatus,
  RequestAttachment,
  RequestWithDetails,
  ROLE_STEP_MAP,
} from '../request.types.js';
import {
  REQUESTER_FIELDS,
  REQUESTER_JOINS,
  mapRequestRow,
  hydrateRequests,
  buildInClause,
} from './helpers.js';
import {
  getScopeFilterForApprover,
  getScopeFilterForSelectedScope,
  canApproverAccessRequest,
} from '../scope/scope.service.js';

// ============================================================================
// User's Requests
// ============================================================================

export async function getMyRequests(userId: number): Promise<RequestWithDetails[]> {
  const requests = await query<RowDataPacket[]>(
    `SELECT r.*, u.citizen_id, u.role
     FROM req_submissions r
     JOIN users u ON r.user_id = u.id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC`,
    [userId],
  );

  const requestRows = Array.isArray(requests) ? requests : [];
  return await hydrateRequests(requestRows);
}

// ============================================================================
// Pending Requests for Approver
// ============================================================================

export async function getPendingForApprover(
  userRole: string,
  userId?: number,
  selectedScope?: string,
): Promise<RequestWithDetails[]> {
  const stepNo = ROLE_STEP_MAP[userRole];

  if (!stepNo) {
    throw new Error(`Invalid approver role: ${userRole}`);
  }

  let sql = `SELECT ${REQUESTER_FIELDS},
       e.department AS emp_department,
       e.sub_department AS emp_sub_department
     FROM req_submissions r
     ${REQUESTER_JOINS}
     WHERE r.status = ? AND r.current_step = ?`;

  const params: (string | number)[] = [RequestStatus.PENDING, stepNo];

  // Apply scope filter for HEAD_WARD and HEAD_DEPT
  if (userId && (userRole === 'HEAD_WARD' || userRole === 'HEAD_DEPT')) {
    if (selectedScope) {
      const scopeFilter = await getScopeFilterForSelectedScope(userId, userRole, selectedScope);
      if (scopeFilter) {
        sql += scopeFilter.whereClause;
        params.push(...scopeFilter.params);
      }
    } else {
      const scopeFilter = await getScopeFilterForApprover(userId, userRole);
      if (scopeFilter) {
        sql += scopeFilter.whereClause;
        params.push(...scopeFilter.params);
      }
    }
  }

  sql += ' ORDER BY r.created_at ASC';

  const requests = await query<RowDataPacket[]>(sql, params);
  const requestRows = Array.isArray(requests) ? requests : [];
  return await hydrateRequests(requestRows);
}

// ============================================================================
// Approval History
// ============================================================================

export async function getApprovalHistory(actorId: number): Promise<RequestWithDetails[]> {
  const historyIds = await query<RowDataPacket[]>(
    `SELECT request_id, MAX(created_at) as last_action_date
     FROM req_approvals
     WHERE actor_id = ?
       AND action IN ('APPROVE', 'REJECT', 'RETURN')
     GROUP BY request_id
     ORDER BY last_action_date DESC`,
    [actorId],
  );

  const requestRows = Array.isArray(historyIds) ? historyIds : [];
  if (requestRows.length === 0) return [];

  const { clause, params } = buildInClause(requestRows.map((row) => row.request_id));

  const fullRequests = await query<RowDataPacket[]>(
    `SELECT ${REQUESTER_FIELDS}
     FROM req_submissions r
     ${REQUESTER_JOINS}
     WHERE r.request_id IN (${clause})
     ORDER BY r.updated_at DESC`,
    params,
  );

  return await hydrateRequests(Array.isArray(fullRequests) ? fullRequests : []);
}

// ============================================================================
// Get Request by ID (with Access Control)
// ============================================================================

export async function getRequestById(
  requestId: number,
  userId: number,
  userRole: string,
): Promise<RequestWithDetails> {
  const requests = await query<RowDataPacket[]>(
    `SELECT ${REQUESTER_FIELDS},
       e.department AS emp_department,
       e.sub_department AS emp_sub_department
     FROM req_submissions r
     ${REQUESTER_JOINS}
     WHERE r.request_id = ?`,
    [requestId],
  );

  if (requests.length === 0) {
    throw new Error('Request not found');
  }

  const request = requests[0];

  const isOwner = request.user_id === userId;
  const isAdmin = userRole === 'ADMIN';

  // Check if user is approver at the current step
  let isApprover =
    ROLE_STEP_MAP[userRole] !== undefined &&
    request.status === RequestStatus.PENDING &&
    request.current_step === ROLE_STEP_MAP[userRole];

  // For HEAD_WARD and HEAD_DEPT, also verify scope access
  if (isApprover && (userRole === 'HEAD_WARD' || userRole === 'HEAD_DEPT')) {
    const hasScope = await canApproverAccessRequest(
      userId,
      userRole,
      request.emp_department,
      request.emp_sub_department,
    );
    if (!hasScope) {
      isApprover = false;
    }
  }

  if (!isOwner && !isApprover && !isAdmin) {
    const actionRows = await query<RowDataPacket[]>(
      'SELECT 1 FROM req_approvals WHERE request_id = ? AND actor_id = ? LIMIT 1',
      [requestId, userId],
    );
    const isActor = actionRows.length > 0;

    if (!isActor) {
      throw new Error('You do not have permission to view this request');
    }
  }

  const details = await getRequestDetails(requestId);
  details.requester = {
    citizen_id: request.requester_citizen_id,
    role: request.requester_role,
    first_name: request.req_first_name,
    last_name: request.req_last_name,
    position: request.req_position,
  };

  return details;
}

// ============================================================================
// Get Request Details (Internal)
// ============================================================================

export async function getRequestDetails(requestId: number): Promise<RequestWithDetails> {
  const requests = await query<RowDataPacket[]>(
    'SELECT * FROM req_submissions WHERE request_id = ?',
    [requestId],
  );

  if (requests.length === 0) {
    throw new Error('Request not found');
  }

  const request = mapRequestRow(requests[0]);

  const attachments = await query<RowDataPacket[]>(
    `SELECT a.*,
            o.status AS ocr_status,
            o.confidence AS ocr_confidence,
            o.provider AS ocr_provider,
            o.processed_at AS ocr_processed_at
     FROM req_attachments a
     LEFT JOIN req_ocr_results o ON a.attachment_id = o.attachment_id
     WHERE a.request_id = ?
     ORDER BY a.uploaded_at DESC`,
    [requestId],
  );

  const actions = await query<RowDataPacket[]>(
    `SELECT a.*,
            u.citizen_id as actor_citizen_id,
            u.role as actor_role,
            COALESCE(e.first_name, s.first_name) as actor_first_name,
            COALESCE(e.last_name, s.last_name) as actor_last_name
     FROM req_approvals a
     JOIN users u ON a.actor_id = u.id
     LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
     LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
     WHERE a.request_id = ?
     ORDER BY a.created_at ASC`,
    [requestId],
  );

  const actionsWithActor = actions.map((action) => ({
    action_id: action.action_id,
    request_id: action.request_id,
    actor_id: action.actor_id,
    action: action.action,
    action_type: action.action,
    step_no: action.step_no,
    from_step: action.step_no,
    to_step: action.step_no,
    comment: action.comment,
    action_date: action.created_at,
    created_at: action.created_at,
    signature_snapshot: action.signature_snapshot,
    actor: {
      citizen_id: action.actor_citizen_id,
      role: action.actor_role,
      first_name: action.actor_first_name,
      last_name: action.actor_last_name,
    },
  }));

  return {
    ...request,
    attachments: attachments.map((att) => ({
      attachment_id: att.attachment_id,
      request_id: att.request_id,
      file_type: att.file_type,
      file_path: att.file_path,
      file_name: att.file_name,
      original_filename: att.file_name,
      file_size: att.file_size,
      mime_type: att.mime_type,
      uploaded_at: att.uploaded_at,
      ocr_status: att.ocr_status,
      ocr_confidence: att.ocr_confidence,
      ocr_provider: att.ocr_provider,
      ocr_processed_at: att.ocr_processed_at,
    })) as RequestAttachment[],
    actions: actionsWithActor,
  };
}

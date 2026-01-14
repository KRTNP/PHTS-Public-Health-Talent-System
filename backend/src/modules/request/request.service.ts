/**
 * PHTS System - Request Service Layer (V2.0)
 *
 * Aligns request workflow with Database V2.0:
 * - Uses applicant_signature_id from pts_user_signatures
 * - Stores approver signature snapshots as BLOB
 * - Finalization creates eligibility records (no legacy rate_adjustments table)
 */

import { randomUUID } from 'crypto';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import { readFile } from 'fs/promises';
import { query, getConnection } from '../../config/database.js';
import {
  RequestStatus,
  ActionType,
  FileType,
  PTSRequest,
  RequestAttachment,
  RequestWithDetails,
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
  CreateRequestDTO,
  BatchApproveParams,
  BatchApproveResult,
} from './request.types.js';
import { NotificationService } from '../notification/notification.service.js';
import { findRecommendedRate, MasterRate } from './classification.service.js';
import { createEligibility } from './eligibility.service.js';
import { saveSignature } from '../signature/signature.service.js';
import {
  getScopeFilterForApprover,
  getScopeFilterForSelectedScope,
  canApproverAccessRequest,
  canSelfApprove,
  isRequestOwner,
} from './scope.service.js';

// Common select/join fragments for requester info
const REQUESTER_FIELDS = `
  r.*,
  u.citizen_id AS requester_citizen_id,
  u.role AS requester_role,
  COALESCE(e.first_name, s.first_name) AS req_first_name,
  COALESCE(e.last_name, s.last_name) AS req_last_name,
  COALESCE(e.position_name, s.position_name) AS req_position
`;

const REQUESTER_JOINS = `
  JOIN users u ON r.user_id = u.id
  LEFT JOIN pts_employees e ON u.citizen_id = e.citizen_id
  LEFT JOIN pts_support_employees s ON u.citizen_id = s.citizen_id
`;

/**
 * Generate a unique request number.
 */
function generateRequestNo(): string {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = randomUUID().split('-')[0].substring(0, 4).toUpperCase();
  return `REQ-${datePart}-${randomPart}`;
}

/**
 * Safely parse a JSON column.
 */
function parseJsonField<T = any>(value: any): T | null {
  if (!value) return null;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Normalize date input to `YYYY-MM-DD` (safely handles strings with timezones).
 */
function normalizeDateToYMD(value: string | Date): string {
  if (!value) {
    throw new Error('effective_date is required');
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  throw new Error('Invalid effective_date format');
}

/**
 * Normalize DB row to API shape (keeps backward-compatible fields).
 */
function mapRequestRow(row: any): PTSRequest & {
  request_no?: string;
  applicant_signature_id?: number | null;
} {
  const submissionData = parseJsonField(row.submission_data);
  const workAttributes = parseJsonField(row.work_attributes);
  const mainDuty = row.main_duty ?? submissionData?.main_duty ?? null;

  return {
    request_id: row.request_id,
    user_id: row.user_id,
    request_no: row.request_no,
    personnel_type: row.personnel_type,
    position_number: row.current_position_number ?? row.position_number ?? null,
    department_group: row.current_department ?? row.department_group ?? null,
    main_duty: mainDuty,
    work_attributes: workAttributes,
    applicant_signature: null,
    applicant_signature_id: row.applicant_signature_id ?? null,
    request_type: row.request_type,
    requested_amount: row.requested_amount,
    effective_date: row.effective_date,
    status: row.status,
    current_step: row.current_step,
    submission_data: submissionData,
    created_at: row.created_at,
    updated_at: row.updated_at,
    submitted_at: row.submitted_at ?? null,
  } as any;
}

function buildInClause(ids: number[]): { clause: string; params: number[] } {
  const placeholders = ids.map(() => '?').join(', ');
  return { clause: placeholders, params: ids };
}

async function hydrateRequests(requestRows: any[]): Promise<RequestWithDetails[]> {
  if (!requestRows.length) return [];

  const ids = requestRows.map((row) => row.request_id);
  const { clause, params } = buildInClause(ids);

  const attachments = await query<RowDataPacket[]>(
    `SELECT * FROM pts_attachments WHERE request_id IN (${clause}) ORDER BY uploaded_at DESC`,
    params,
  );

  const actions = await query<RowDataPacket[]>(
    `SELECT a.*,
            u.citizen_id as actor_citizen_id,
            u.role as actor_role,
            COALESCE(e.first_name, s.first_name) as actor_first_name,
            COALESCE(e.last_name, s.last_name) as actor_last_name
     FROM pts_request_actions a
     JOIN users u ON a.actor_id = u.id
     LEFT JOIN pts_employees e ON u.citizen_id = e.citizen_id
     LEFT JOIN pts_support_employees s ON u.citizen_id = s.citizen_id
     WHERE a.request_id IN (${clause})
     ORDER BY a.created_at ASC`,
    params,
  );

  const attachmentsByRequest = new Map<number, RowDataPacket[]>();
  for (const att of attachments as any[]) {
    const list = attachmentsByRequest.get(att.request_id) || [];
    list.push(att);
    attachmentsByRequest.set(att.request_id, list);
  }

  const actionsByRequest = new Map<number, RowDataPacket[]>();
  for (const action of actions as any[]) {
    const list = actionsByRequest.get(action.request_id) || [];
    list.push(action);
    actionsByRequest.set(action.request_id, list);
  }

  return requestRows.map((row) => {
    const request = mapRequestRow(row) as RequestWithDetails;
    const requestId = row.request_id;

    request.attachments = (attachmentsByRequest.get(requestId) || []).map((att: any) => ({
      attachment_id: att.attachment_id,
      request_id: att.request_id,
      file_type: att.file_type,
      file_path: att.file_path,
      file_name: att.file_name,
      original_filename: att.file_name,
      file_size: att.file_size,
      mime_type: att.mime_type,
      uploaded_at: att.uploaded_at,
    })) as RequestAttachment[];

    request.actions = (actionsByRequest.get(requestId) || []).map((action: any) => ({
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

    if (row.requester_citizen_id) {
      request.requester = {
        citizen_id: row.requester_citizen_id,
        role: row.requester_role,
        first_name: row.req_first_name,
        last_name: row.req_last_name,
        position: row.req_position,
      };
    }

    return request;
  });
}

/**
 * Public helper: recommended master rate for a given user.
 */
export async function getRecommendedRateForUser(userId: number): Promise<MasterRate | null> {
  const users = await query<RowDataPacket[]>(
    'SELECT citizen_id FROM users WHERE id = ? LIMIT 1',
    [userId],
  );

  if (!users || users.length === 0) {
    throw new Error('User not found');
  }

  const citizenId = (users[0] as any).citizen_id as string;
  return await findRecommendedRate(citizenId);
}

/**
 * Create a new request (DRAFT)
 */
export async function createRequest(
  userId: number,
  data: CreateRequestDTO,
  files?: Express.Multer.File[],
  signatureFile?: Express.Multer.File,
): Promise<RequestWithDetails> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Ensure citizen_id is available for the insert
    const [userRows] = await connection.query<RowDataPacket[]>(
      'SELECT citizen_id FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    if (!userRows.length) {
      throw new Error('User not found');
    }
    const citizenId = (userRows[0] as any).citizen_id as string;

    // 1) Handle signature: if a new file is uploaded, upsert; otherwise use existing
    let signatureId: number | null = null;
    if (signatureFile) {
      const sigBuffer =
        signatureFile.buffer && signatureFile.buffer.length > 0
          ? signatureFile.buffer
          : await readFile(signatureFile.path);

      signatureId = await saveSignature(userId, sigBuffer, connection);
    } else {
      const [sigs] = await connection.query<RowDataPacket[]>(
        'SELECT signature_id FROM pts_user_signatures WHERE user_id = ?',
        [userId],
      );
      signatureId = sigs.length ? (sigs[0] as any).signature_id : null;
    }

    if (!signatureId) {
      throw new Error('ไม่พบข้อมูลลายเซ็น กรุณาเซ็นชื่อก่อนยื่นคำขอ');
    }

    // 2) Serialize JSON payloads
    const workAttributesJson = data.work_attributes ? JSON.stringify(data.work_attributes) : null;
    const submissionDataJson = data.submission_data
      ? JSON.stringify({ ...data.submission_data, main_duty: data.main_duty ?? null })
      : data.main_duty
        ? JSON.stringify({ main_duty: data.main_duty })
        : null;

    // Validate mandatory fields required by schema
    if (data.requested_amount === undefined || data.requested_amount === null) {
      throw new Error('requested_amount is required');
    }
    const effectiveDateStr = normalizeDateToYMD(data.effective_date as any);

    // 3) Insert request (V2 schema)
    const requestNo = generateRequestNo();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO pts_requests
       (user_id, citizen_id, request_no, personnel_type, current_position_number, current_department,
        work_attributes, applicant_signature_id, request_type, requested_amount,
        effective_date, status, current_step, submission_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        citizenId,
        requestNo,
        data.personnel_type,
        data.position_number || null,
        data.department_group || null,
        workAttributesJson,
        signatureId,
        data.request_type,
        data.requested_amount,
        effectiveDateStr,
        RequestStatus.DRAFT,
        1,
        submissionDataJson,
      ],
    );

    const requestId = result.insertId;

    // 4) Insert attachments
    if (files && files.length > 0) {
      for (const file of files) {
        let fileType = FileType.OTHER;
        if (file.fieldname === 'license_file') fileType = FileType.LICENSE;

        await connection.execute<ResultSetHeader>(
          `INSERT INTO pts_attachments
           (request_id, file_type, file_path, file_name)
           VALUES (?, ?, ?, ?)`,
          [requestId, fileType, file.path, file.originalname],
        );
      }
    }

    await connection.commit();

    return await getRequestDetails(requestId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Submit a draft request
 */
export async function submitRequest(requestId: number, userId: number): Promise<PTSRequest> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ? AND user_id = ?',
      [requestId, userId],
    );

    if (requests.length === 0) {
      throw new Error('Request not found or you do not have permission');
    }

    const request = mapRequestRow(requests[0]);

    if (request.status !== RequestStatus.DRAFT) {
      throw new Error(`Cannot submit request with status: ${request.status}`);
    }

    await connection.execute(
      `UPDATE pts_requests
       SET status = ?, current_step = ?, updated_at = NOW()
       WHERE request_id = ?`,
      [RequestStatus.PENDING, 1, requestId],
    );

    await connection.execute(
      `INSERT INTO pts_request_actions
       (request_id, actor_id, step_no, action, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, userId, 1, ActionType.SUBMIT, null],
    );

    await connection.commit();

    await NotificationService.notifyRole(
      'HEAD_DEPT',
      'มีคำขอใหม่รออนุมัติ',
      `มีคำขอเลขที่ ${request.request_no} รอการตรวจสอบจากท่าน`,
      `/dashboard/approver/requests/${requestId}`,
    );

    const [updatedRequests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId],
    );

    return mapRequestRow(updatedRequests[0]) as PTSRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all requests created by a specific user
 */
export async function getMyRequests(userId: number): Promise<RequestWithDetails[]> {
  const requests = await query<RowDataPacket[]>(
    `SELECT r.*, u.citizen_id, u.role
     FROM pts_requests r
     JOIN users u ON r.user_id = u.id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC`,
    [userId],
  );

  const requestRows = Array.isArray(requests) ? (requests as any[]) : [];
  return await hydrateRequests(requestRows);
}

/**
 * Get pending requests for a specific approver role with scope filtering
 *
 * For HEAD_WARD and HEAD_DEPT, requests are filtered based on the approver's
 * scope derived from their special_position in pts_employees.
 *
 * @param userRole - The approver's role
 * @param userId - The approver's user ID (required for scope filtering)
 * @param selectedScope - Optional: filter to a specific scope (for multi-scope users)
 */
export async function getPendingForApprover(
  userRole: string,
  userId?: number,
  selectedScope?: string,
): Promise<RequestWithDetails[]> {
  const stepNo = ROLE_STEP_MAP[userRole];

  if (!stepNo) {
    throw new Error(`Invalid approver role: ${userRole}`);
  }

  // Build base query with employee join for scope filtering
  let sql = `SELECT ${REQUESTER_FIELDS},
       e.department AS emp_department,
       e.sub_department AS emp_sub_department
     FROM pts_requests r
     ${REQUESTER_JOINS}
     LEFT JOIN pts_employees e ON r.citizen_id = e.citizen_id
     WHERE r.status = ? AND r.current_step = ?`;

  const params: any[] = [RequestStatus.PENDING, stepNo];

  // Apply scope filter for HEAD_WARD and HEAD_DEPT
  if (userId && (userRole === 'HEAD_WARD' || userRole === 'HEAD_DEPT')) {
    // If a specific scope is selected, filter to that scope only
    if (selectedScope) {
      const scopeFilter = await getScopeFilterForSelectedScope(userId, userRole, selectedScope);
      if (scopeFilter) {
        sql += scopeFilter.whereClause;
        params.push(...scopeFilter.params);
      }
    } else {
      // Otherwise, show all scopes the user has access to
      const scopeFilter = await getScopeFilterForApprover(userId, userRole);
      if (scopeFilter) {
        sql += scopeFilter.whereClause;
        params.push(...scopeFilter.params);
      }
    }
  }

  sql += ' ORDER BY r.created_at ASC';

  const requests = await query<RowDataPacket[]>(sql, params);
  const requestRows = Array.isArray(requests) ? (requests as any[]) : [];
  return await hydrateRequests(requestRows);
}

/**
 * Get approval history for a specific actor (approver).
 */
export async function getApprovalHistory(actorId: number): Promise<RequestWithDetails[]> {
  const historyIds = await query<RowDataPacket[]>(
    `SELECT request_id, MAX(created_at) as last_action_date
     FROM pts_request_actions
     WHERE actor_id = ?
       AND action IN ('APPROVE', 'REJECT', 'RETURN')
     GROUP BY request_id
     ORDER BY last_action_date DESC`,
    [actorId],
  );

  const requestRows = Array.isArray(historyIds) ? (historyIds as any[]) : [];
  if (requestRows.length === 0) return [];

  const { clause, params } = buildInClause(requestRows.map((row) => row.request_id));

  const fullRequests = await query<RowDataPacket[]>(
    `SELECT ${REQUESTER_FIELDS}
     FROM pts_requests r
     ${REQUESTER_JOINS}
     WHERE r.request_id IN (${clause})
     ORDER BY r.updated_at DESC`,
    params,
  );

  return await hydrateRequests(Array.isArray(fullRequests) ? fullRequests : []);
}

/**
 * Get full request details by ID with access control and scope verification
 */
export async function getRequestById(
  requestId: number,
  userId: number,
  userRole: string,
): Promise<RequestWithDetails> {
  const requests = await query<RowDataPacket[]>(
    `SELECT ${REQUESTER_FIELDS},
       e.department AS emp_department,
       e.sub_department AS emp_sub_department
     FROM pts_requests r
     ${REQUESTER_JOINS}
     LEFT JOIN pts_employees e ON r.citizen_id = e.citizen_id
     WHERE r.request_id = ?`,
    [requestId],
  );

  if (requests.length === 0) {
    throw new Error('Request not found');
  }

  const request = requests[0] as any;

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
      isApprover = false; // No scope access, not a valid approver for this request
    }
  }

  if (!isOwner && !isApprover && !isAdmin) {
    const actionRows = await query<RowDataPacket[]>(
      'SELECT 1 FROM pts_request_actions WHERE request_id = ? AND actor_id = ? LIMIT 1',
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

/**
 * Approve a request with scope verification and self-approval support
 */
export async function approveRequest(
  requestId: number,
  actorId: number,
  actorRole: string,
  comment?: string,
): Promise<PTSRequest> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.query<RowDataPacket[]>(
      `SELECT r.*, e.department AS emp_department, e.sub_department AS emp_sub_department
       FROM pts_requests r
       LEFT JOIN pts_employees e ON r.citizen_id = e.citizen_id
       WHERE r.request_id = ?`,
      [requestId],
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = mapRequestRow(requests[0]);
    const empDepartment = (requests[0] as any).emp_department;
    const empSubDepartment = (requests[0] as any).emp_sub_department;

    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot approve request with status: ${request.status}`);
    }

    const expectedRole = STEP_ROLE_MAP[request.current_step];
    if (expectedRole !== actorRole) {
      throw new Error(`Invalid approver role. Expected ${expectedRole}, got ${actorRole}`);
    }

    // For HEAD_WARD and HEAD_DEPT, verify scope access
    if (actorRole === 'HEAD_WARD' || actorRole === 'HEAD_DEPT') {
      const hasScope = await canApproverAccessRequest(
        actorId,
        actorRole,
        empDepartment,
        empSubDepartment,
      );

      // Check for self-approval case
      const isSelfApproval = await isRequestOwner(actorId, request.user_id);

      if (!hasScope && !isSelfApproval) {
        throw new Error('You do not have scope access to approve this request');
      }

      // Self-approval is allowed per docs for HEAD_WARD (step 1) and HEAD_DEPT (step 2)
      if (isSelfApproval && !canSelfApprove(actorRole, request.current_step)) {
        throw new Error('Self-approval is not allowed at this step');
      }
    }

    // Approver signature snapshot (BLOB)
    const [sigRows] = await connection.query<RowDataPacket[]>(
      'SELECT signature_image FROM pts_user_signatures WHERE user_id = ? LIMIT 1',
      [actorId],
    );
    const signatureSnapshot = sigRows.length ? (sigRows[0] as any).signature_image : null;

    if (!signatureSnapshot) {
      throw new Error(
        'Approver signature is required. Please set your signature before approving.',
      );
    }
    await _performApproval(
      connection,
      request,
      requestId,
      actorId,
      comment || null,
      signatureSnapshot,
    );

    await connection.commit();

    // Notify next approver role (if not finalized)
    const nextStep = request.current_step + 1;
    if (nextStep <= 6) {
      const nextRole = STEP_ROLE_MAP[nextStep];
      if (nextRole) {
        await NotificationService.notifyRole(
          nextRole,
          'มีคำขอใหม่รออนุมัติ',
          `มีคำขอเลขที่ ${request.request_no} รอการตรวจสอบจากท่าน`,
          `/dashboard/approver/requests/${requestId}`,
        );
      }
    }

    const [updatedRequests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId],
    );

    return mapRequestRow(updatedRequests[0]) as PTSRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Reject a request with scope verification
 */
export async function rejectRequest(
  requestId: number,
  actorId: number,
  actorRole: string,
  comment: string,
): Promise<PTSRequest> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.query<RowDataPacket[]>(
      `SELECT r.*, e.department AS emp_department, e.sub_department AS emp_sub_department
       FROM pts_requests r
       LEFT JOIN pts_employees e ON r.citizen_id = e.citizen_id
       WHERE r.request_id = ?`,
      [requestId],
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = mapRequestRow(requests[0]);
    const empDepartment = (requests[0] as any).emp_department;
    const empSubDepartment = (requests[0] as any).emp_sub_department;

    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot reject request with status: ${request.status}`);
    }

    const expectedRole = STEP_ROLE_MAP[request.current_step];
    if (expectedRole !== actorRole) {
      throw new Error(`Invalid approver role. Expected ${expectedRole}, got ${actorRole}`);
    }

    // For HEAD_WARD and HEAD_DEPT, verify scope access
    if (actorRole === 'HEAD_WARD' || actorRole === 'HEAD_DEPT') {
      const hasScope = await canApproverAccessRequest(
        actorId,
        actorRole,
        empDepartment,
        empSubDepartment,
      );
      if (!hasScope) {
        throw new Error('You do not have scope access to reject this request');
      }
    }

    if (!comment || comment.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    const currentStep = request.current_step;

    await connection.execute(
      `INSERT INTO pts_request_actions
       (request_id, actor_id, step_no, action, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, actorId, currentStep, ActionType.REJECT, comment],
    );

    await connection.execute(
      `UPDATE pts_requests
       SET status = ?, updated_at = NOW()
       WHERE request_id = ?`,
      [RequestStatus.REJECTED, requestId],
    );

    await connection.commit();

    await NotificationService.notifyUser(
      request.user_id,
      'คำขอถูกปฏิเสธ',
      `คำขอเลขที่ ${request.request_no} ถูกปฏิเสธ: ${comment}`,
      `/dashboard/user/requests/${requestId}`,
      'ERROR',
    );

    const [updatedRequests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId],
    );

    return mapRequestRow(updatedRequests[0]) as PTSRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Return a request to the previous step with scope verification
 */
export async function returnRequest(
  requestId: number,
  actorId: number,
  actorRole: string,
  comment: string,
): Promise<PTSRequest> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.query<RowDataPacket[]>(
      `SELECT r.*, e.department AS emp_department, e.sub_department AS emp_sub_department
       FROM pts_requests r
       LEFT JOIN pts_employees e ON r.citizen_id = e.citizen_id
       WHERE r.request_id = ?`,
      [requestId],
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = mapRequestRow(requests[0]);
    const empDepartment = (requests[0] as any).emp_department;
    const empSubDepartment = (requests[0] as any).emp_sub_department;

    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot return request with status: ${request.status}`);
    }

    if (request.current_step <= 1) {
      throw new Error('Cannot return request from the first approval step');
    }

    const expectedRole = STEP_ROLE_MAP[request.current_step];
    if (expectedRole !== actorRole) {
      throw new Error(`Invalid approver role. Expected ${expectedRole}, got ${actorRole}`);
    }

    // For HEAD_WARD and HEAD_DEPT, verify scope access
    if (actorRole === 'HEAD_WARD' || actorRole === 'HEAD_DEPT') {
      const hasScope = await canApproverAccessRequest(
        actorId,
        actorRole,
        empDepartment,
        empSubDepartment,
      );
      if (!hasScope) {
        throw new Error('You do not have scope access to return this request');
      }
    }

    if (!comment || comment.trim() === '') {
      throw new Error('Return reason is required');
    }

    const currentStep = request.current_step;
    const previousStep = currentStep - 1;

    await connection.execute(
      `INSERT INTO pts_request_actions
       (request_id, actor_id, step_no, action, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, actorId, currentStep, ActionType.RETURN, comment],
    );

    await connection.execute(
      `UPDATE pts_requests
       SET status = ?, current_step = ?, updated_at = NOW()
       WHERE request_id = ?`,
      [RequestStatus.RETURNED, previousStep, requestId],
    );

    await connection.commit();

    await NotificationService.notifyUser(
      request.user_id,
      'คำขอถูกส่งคืนแก้ไข',
      `คำขอเลขที่ ${request.request_no} ถูกส่งคืน: ${comment}`,
      `/dashboard/user/requests/${requestId}`,
      'WARNING',
    );

    const [updatedRequests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId],
    );

    return mapRequestRow(updatedRequests[0]) as PTSRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Batch approve (Director or Head Finance)
 */
export async function approveBatch(
  actorId: number,
  actorRole: string,
  params: BatchApproveParams,
): Promise<BatchApproveResult> {
  const { requestIds, comment } = params;
  const result: BatchApproveResult = { success: [], failed: [] };

  const expectedStep = ROLE_STEP_MAP[actorRole];
  const allowedSteps =
    actorRole === 'DIRECTOR'
      ? [5, 6] // HEAD_FINANCE (5) or DIRECTOR (6) step
      : expectedStep !== undefined
        ? [expectedStep]
        : [];

  if (allowedSteps.length === 0 || !allowedSteps.some((s) => s === 5 || s === 6)) {
    throw new Error(`Batch approval not supported for role: ${actorRole}`);
  }

  const connection = await getConnection();

  try {
    // Fetch approver signature once (same approver for all)
    const [sigRows] = await connection.query<RowDataPacket[]>(
      'SELECT signature_image FROM pts_user_signatures WHERE user_id = ? LIMIT 1',
      [actorId],
    );
    const signatureSnapshot = sigRows.length ? (sigRows[0] as any).signature_image : null;

    if (!signatureSnapshot) {
      throw new Error(
        'Approver signature is required. Please set your signature before approving.',
      );
    }

    for (const requestId of requestIds) {
      try {
        // Each request gets its own transaction to avoid cross-contamination
        await connection.beginTransaction();

        const [rows] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM pts_requests WHERE request_id = ? FOR UPDATE',
          [requestId],
        );

        if (rows.length === 0) {
          await connection.rollback();
          result.failed.push({ id: requestId, reason: 'Request not found' });
          continue;
        }

        const request = mapRequestRow(rows[0]);

        if (!allowedSteps.includes(request.current_step)) {
          await connection.rollback();
          result.failed.push({
            id: requestId,
            reason: `Not at allowed step (${allowedSteps.join(
              '/',
            )}) (currently at Step ${request.current_step})`,
          });
          continue;
        }

        if (request.status !== RequestStatus.PENDING) {
          await connection.rollback();
          result.failed.push({
            id: requestId,
            reason: `Status is ${request.status}, not PENDING`,
          });
          continue;
        }

        await _performApproval(connection, request, requestId, actorId, comment || null, signatureSnapshot);

        await connection.commit();
        result.success.push(requestId);
      } catch (err) {
        await connection.rollback();
        console.error(`Error processing request ${requestId}:`, err);
        result.failed.push({ id: requestId, reason: 'Database error or Finalization failed' });
      }
    }

    return result;
  } finally {
    connection.release();
  }
}

/**
 * Internal helper to perform approval (action log, step update, finalization)
 */
async function _performApproval(
  connection: PoolConnection,
  request: PTSRequest,
  requestId: number,
  actorId: number,
  comment: string | null,
  signatureSnapshot: Buffer,
): Promise<void> {
  const currentStep = request.current_step;
  const nextStep = currentStep + 1;

  await connection.execute(
    `INSERT INTO pts_request_actions
     (request_id, actor_id, step_no, action, comment, signature_snapshot)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [requestId, actorId, currentStep, ActionType.APPROVE, comment, signatureSnapshot],
  );

  if (nextStep > 6) {
    // All 6 steps completed - finalize request
    await connection.execute(
      `UPDATE pts_requests
       SET status = ?, current_step = 7, updated_at = NOW()
       WHERE request_id = ?`,
      [RequestStatus.APPROVED, requestId],
    );
    await finalizeRequest(requestId, actorId, connection);
    await NotificationService.notifyUser(
      request.user_id,
      'คำขออนุมัติแล้ว',
      `คำขอเลขที่ ${request.request_no} ได้รับการอนุมัติครบทุกขั้นตอนแล้ว`,
      `/dashboard/user/requests/${requestId}`,
      'SUCCESS',
    );
  } else {
    await connection.execute(
      `UPDATE pts_requests
       SET current_step = ?, updated_at = NOW()
       WHERE request_id = ?`,
      [nextStep, requestId],
    );
    const nextRole = STEP_ROLE_MAP[nextStep];
    if (nextRole) {
      await NotificationService.notifyRole(
        nextRole,
        'งานรออนุมัติ',
        `มีคำขอเลขที่ ${request.request_no} ส่งต่อมาถึงท่าน`,
        `/dashboard/approver/requests/${requestId}`,
      );
    }
  }
}

// ============================================
// Finalization ("The Bridge" V3.0 - Eligibility only)
// ============================================
export async function finalizeRequest(
  requestId: number,
  _finalApproverId: number,
  connection: PoolConnection,
): Promise<void> {
  const [requests] = await connection.query<RowDataPacket[]>(
    `SELECT r.*, u.citizen_id
     FROM pts_requests r
     JOIN users u ON r.user_id = u.id
     WHERE r.request_id = ?`,
    [requestId],
  );

  if (!requests.length) {
    throw new Error(`Request ${requestId} not found during finalization`);
  }

  const request = mapRequestRow(requests[0]) as PTSRequest & { citizen_id: string };
  const citizenId = (requests[0] as any).citizen_id as string;

  if (request.requested_amount && request.requested_amount > 0) {
    if (!request.effective_date) {
      throw new Error('effective_date is required for finalization');
    }

    const effectiveDateStr = normalizeDateToYMD(request.effective_date as any);

    const recommendedRate = await findRecommendedRate(citizenId);
    let targetRateId: number | null = null;

    if (recommendedRate && recommendedRate.amount === Number(request.requested_amount)) {
      targetRateId = recommendedRate.rate_id;
    } else {
      const professionCode = (recommendedRate as any)?.profession_code;
      let sql = `SELECT rate_id FROM pts_master_rates WHERE amount = ? AND is_active = 1`;
      const params: (string | number | null)[] = [request.requested_amount];
      if (professionCode) {
        sql += ` AND profession_code = ?`;
        params.push(professionCode);
      }
      sql += ` LIMIT 1`;

      const [rates] = await connection.query<RowDataPacket[]>(sql, params);
      if (rates.length === 0) {
        throw new Error(
          'Unable to resolve master rate for finalization. Please verify profession and rate configuration.',
        );
      }
      targetRateId = (rates[0] as any).rate_id as number;
    }

    if (!targetRateId) {
      throw new Error('Unable to resolve master rate during finalization.');
    }

    await createEligibility(connection, citizenId, targetRateId, effectiveDateStr, requestId);
  }
}

/**
 * Helper: request details with attachments & actions
 */
async function getRequestDetails(requestId: number): Promise<RequestWithDetails> {
  const requests = await query<RowDataPacket[]>('SELECT * FROM pts_requests WHERE request_id = ?', [
    requestId,
  ]);

  if (requests.length === 0) {
    throw new Error('Request not found');
  }

  const request = mapRequestRow(requests[0]);

  const attachments = await query<RowDataPacket[]>(
    'SELECT * FROM pts_attachments WHERE request_id = ? ORDER BY uploaded_at DESC',
    [requestId],
  );

  const actions = await query<RowDataPacket[]>(
    `SELECT a.*,
            u.citizen_id as actor_citizen_id,
            u.role as actor_role,
            COALESCE(e.first_name, s.first_name) as actor_first_name,
            COALESCE(e.last_name, s.last_name) as actor_last_name
     FROM pts_request_actions a
    JOIN users u ON a.actor_id = u.id
     LEFT JOIN pts_employees e ON u.citizen_id = e.citizen_id
     LEFT JOIN pts_support_employees s ON u.citizen_id = s.citizen_id
     WHERE a.request_id = ?
     ORDER BY a.created_at ASC`,
    [requestId],
  );

  const actionsWithActor = (actions as any[]).map((action) => ({
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
    attachments: (attachments as any[]).map((att) => ({
      attachment_id: att.attachment_id,
      request_id: att.request_id,
      file_type: att.file_type,
      file_path: att.file_path,
      file_name: att.file_name,
      original_filename: att.file_name,
      file_size: att.file_size,
      mime_type: att.mime_type,
      uploaded_at: att.uploaded_at,
    })) as RequestAttachment[],
    actions: actionsWithActor,
  };
}

// Export helper for other modules
export { getRequestDetails };

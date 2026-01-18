/**
 * Request Module - Approval Service
 *
 * Approval workflow operations: approve, reject, return, batch approve
 */

import { RowDataPacket, PoolConnection } from 'mysql2/promise';
import { getConnection } from '../../config/database.js';
import {
  RequestStatus,
  ActionType,
  PTSRequest,
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
  BatchApproveParams,
  BatchApproveResult,
} from './request.types.js';
import { NotificationService } from '../notification/notification.service.js';
import { findRecommendedRate } from './classification.service.js';
import { createEligibility } from './eligibility.service.js';
import {
  mapRequestRow,
  normalizeDateToYMD,
  getRequestLinkForRole,
} from './request.helpers.js';
import {
  canApproverAccessRequest,
  canSelfApprove,
  isRequestOwner,
} from './scope.service.js';

// ============================================================================
// Approve Request
// ============================================================================

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
       FROM req_submissions r
       LEFT JOIN emp_profiles e ON r.citizen_id = e.citizen_id
       WHERE r.request_id = ?`,
      [requestId],
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = mapRequestRow(requests[0]);
    const empDepartment = requests[0].emp_department;
    const empSubDepartment = requests[0].emp_sub_department;

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

      const isSelfApproval = await isRequestOwner(actorId, request.user_id);

      if (!hasScope && !isSelfApproval) {
        throw new Error('You do not have scope access to approve this request');
      }

      if (isSelfApproval && !canSelfApprove(actorRole, request.current_step)) {
        throw new Error('Self-approval is not allowed at this step');
      }
    }

    // Get approver signature
    const [sigRows] = await connection.query<RowDataPacket[]>(
      'SELECT signature_image FROM sig_images WHERE user_id = ? LIMIT 1',
      [actorId],
    );
    const signatureSnapshot = sigRows.length ? sigRows[0].signature_image : null;

    if (!signatureSnapshot) {
      throw new Error(
        'Approver signature is required. Please set your signature before approving.',
      );
    }

    await performApproval(
      connection,
      request,
      requestId,
      actorId,
      comment || null,
      signatureSnapshot,
    );

    await connection.commit();

    const [updatedRequests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM req_submissions WHERE request_id = ?',
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

// ============================================================================
// Reject Request
// ============================================================================

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
       FROM req_submissions r
       LEFT JOIN emp_profiles e ON r.citizen_id = e.citizen_id
       WHERE r.request_id = ?`,
      [requestId],
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = mapRequestRow(requests[0]);
    const empDepartment = requests[0].emp_department;
    const empSubDepartment = requests[0].emp_sub_department;

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
      `INSERT INTO req_approvals
       (request_id, actor_id, step_no, action, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, actorId, currentStep, ActionType.REJECT, comment],
    );

    await connection.execute(
      `UPDATE req_submissions
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
      'SELECT * FROM req_submissions WHERE request_id = ?',
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

// ============================================================================
// Return Request
// ============================================================================

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
       FROM req_submissions r
       LEFT JOIN emp_profiles e ON r.citizen_id = e.citizen_id
       WHERE r.request_id = ?`,
      [requestId],
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = mapRequestRow(requests[0]);
    const empDepartment = requests[0].emp_department;
    const empSubDepartment = requests[0].emp_sub_department;

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
      `INSERT INTO req_approvals
       (request_id, actor_id, step_no, action, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, actorId, currentStep, ActionType.RETURN, comment],
    );

    await connection.execute(
      `UPDATE req_submissions
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
      'SELECT * FROM req_submissions WHERE request_id = ?',
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

// ============================================================================
// Batch Approve
// ============================================================================

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
      ? [5, 6]
      : expectedStep !== undefined
        ? [expectedStep]
        : [];

  if (allowedSteps.length === 0 || !allowedSteps.some((s) => s === 5 || s === 6)) {
    throw new Error(`Batch approval not supported for role: ${actorRole}`);
  }

  const connection = await getConnection();

  try {
    // Fetch approver signature once
    const [sigRows] = await connection.query<RowDataPacket[]>(
      'SELECT signature_image FROM sig_images WHERE user_id = ? LIMIT 1',
      [actorId],
    );
    const signatureSnapshot = sigRows.length ? sigRows[0].signature_image : null;

    if (!signatureSnapshot) {
      throw new Error(
        'Approver signature is required. Please set your signature before approving.',
      );
    }

    for (const requestId of requestIds) {
      try {
        await connection.beginTransaction();

        const [rows] = await connection.query<RowDataPacket[]>(
          'SELECT * FROM req_submissions WHERE request_id = ? FOR UPDATE',
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
            reason: `Not at allowed step (${allowedSteps.join('/')}) (currently at Step ${request.current_step})`,
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

        await performApproval(
          connection,
          request,
          requestId,
          actorId,
          comment || null,
          signatureSnapshot,
        );

        await connection.commit();
        result.success.push(requestId);
      } catch (err) {
        await connection.rollback();
        console.error('Error processing request', {
          requestId,
          error: err instanceof Error ? err.message : err,
        });
        result.failed.push({ id: requestId, reason: 'Database error or Finalization failed' });
      }
    }

    return result;
  } finally {
    connection.release();
  }
}

// ============================================================================
// Internal: Perform Approval
// ============================================================================

async function performApproval(
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
    `INSERT INTO req_approvals
     (request_id, actor_id, step_no, action, comment, signature_snapshot)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [requestId, actorId, currentStep, ActionType.APPROVE, comment, signatureSnapshot],
  );

  if (nextStep > 6) {
    // All 6 steps completed - finalize request
    await connection.execute(
      `UPDATE req_submissions
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
      `UPDATE req_submissions
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
        getRequestLinkForRole(nextRole, requestId),
      );
    }
  }
}

// ============================================================================
// Finalization
// ============================================================================

export async function finalizeRequest(
  requestId: number,
  _finalApproverId: number,
  connection: PoolConnection,
): Promise<void> {
  const [requests] = await connection.query<RowDataPacket[]>(
    `SELECT r.*, u.citizen_id
     FROM req_submissions r
     JOIN users u ON r.user_id = u.id
     WHERE r.request_id = ?`,
    [requestId],
  );

  if (!requests.length) {
    throw new Error(`Request ${requestId} not found during finalization`);
  }

  const request = mapRequestRow(requests[0]) as PTSRequest & { citizen_id: string };
  const citizenId = requests[0].citizen_id as string;

  if (request.requested_amount && request.requested_amount > 0) {
    if (!request.effective_date) {
      throw new Error('effective_date is required for finalization');
    }

    const effectiveDateStr = normalizeDateToYMD(request.effective_date as string | Date);

    const recommendedRate = await findRecommendedRate(citizenId);
    let targetRateId: number | null = null;

    if (recommendedRate && recommendedRate.amount === Number(request.requested_amount)) {
      targetRateId = recommendedRate.rate_id;
    } else {
      const professionCode = (recommendedRate as unknown as Record<string, unknown>)?.profession_code as string | undefined;
      let sql = `SELECT rate_id FROM cfg_payment_rates WHERE amount = ? AND is_active = 1`;
      const sqlParams: (string | number | null)[] = [request.requested_amount];
      if (professionCode) {
        sql += ` AND profession_code = ?`;
        sqlParams.push(professionCode);
      }
      sql += ` LIMIT 1`;

      const [rates] = await connection.query<RowDataPacket[]>(sql, sqlParams);
      if (rates.length === 0) {
        throw new Error(
          'Unable to resolve master rate for finalization. Please verify profession and rate configuration.',
        );
      }
      targetRateId = rates[0].rate_id as number;
    }

    if (!targetRateId) {
      throw new Error('Unable to resolve master rate during finalization.');
    }

    await createEligibility(connection, citizenId, targetRateId, effectiveDateStr, requestId);
  }
}

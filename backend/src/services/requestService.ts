/**
 * PHTS System - Request Service Layer
 *
 * Business logic for PTS request management and workflow
 *
 * Date: 2025-12-30
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { query, getConnection } from '../config/database.js';
import {
  RequestType,
  RequestStatus,
  ActionType,
  FileType,
  PTSRequest,
  RequestAttachment,
  RequestWithDetails,
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
} from '../types/request.types.js';

/**
 * Create a new request in DRAFT status
 *
 * @param userId - ID of the user creating the request
 * @param requestType - Type of PTS request
 * @param submissionData - Request-specific data as JSON
 * @param files - Uploaded file attachments
 * @returns Created request with attachments
 */
export async function createRequest(
  userId: number,
  requestType: RequestType,
  submissionData: any,
  files?: Express.Multer.File[]
): Promise<RequestWithDetails> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Insert request with DRAFT status
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO pts_requests
       (user_id, request_type, status, current_step, submission_data)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, requestType, RequestStatus.DRAFT, 0, JSON.stringify(submissionData)]
    );

    const requestId = result.insertId;

    // Insert file attachments if provided
    const attachments: RequestAttachment[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const [attachResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO pts_attachments
           (request_id, file_type, file_name, file_path, file_size, mime_type)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            requestId,
            FileType.OTHER, // Default type, can be enhanced later
            file.originalname,
            file.path,
            file.size,
            file.mimetype,
          ]
        );

        attachments.push({
          attachment_id: attachResult.insertId,
          request_id: requestId,
          file_type: FileType.OTHER,
          file_name: file.originalname,
          file_path: file.path,
          file_size: file.size,
          mime_type: file.mimetype,
          uploaded_at: new Date(),
        });
      }
    }

    await connection.commit();

    // Fetch and return the created request
    const [requests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId]
    );

    const request = requests[0] as PTSRequest;

    return {
      ...request,
      attachments,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Submit a draft request to start the approval workflow
 *
 * @param requestId - Request ID to submit
 * @param userId - User ID submitting the request
 * @returns Updated request
 */
export async function submitRequest(
  requestId: number,
  userId: number
): Promise<PTSRequest> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Get current request
    const [requests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ? AND user_id = ?',
      [requestId, userId]
    );

    if (requests.length === 0) {
      throw new Error('Request not found or you do not have permission');
    }

    const request = requests[0] as PTSRequest;

    // Verify status is DRAFT
    if (request.status !== RequestStatus.DRAFT) {
      throw new Error(`Cannot submit request with status: ${request.status}`);
    }

    // Update to PENDING and set current_step to 1
    await connection.execute(
      `UPDATE pts_requests
       SET status = ?, current_step = ?, submitted_at = NOW(), updated_at = NOW()
       WHERE request_id = ?`,
      [RequestStatus.PENDING, 1, requestId]
    );

    // Log SUBMIT action
    await connection.execute(
      `INSERT INTO pts_request_actions
       (request_id, actor_id, action_type, from_step, to_step)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, userId, ActionType.SUBMIT, 0, 1]
    );

    await connection.commit();

    // Fetch and return updated request
    const [updatedRequests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId]
    );

    return updatedRequests[0] as PTSRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all requests created by a specific user
 *
 * @param userId - User ID to filter by
 * @returns List of requests with attachments and actions
 */
export async function getMyRequests(userId: number): Promise<RequestWithDetails[]> {
  const [requests] = await query<RowDataPacket[]>(
    `SELECT r.*, u.citizen_id, u.role
     FROM pts_requests r
     JOIN users u ON r.user_id = u.user_id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC`,
    [userId]
  );

  const requestsWithDetails: RequestWithDetails[] = [];

  for (const request of requests as PTSRequest[]) {
    const details = await getRequestDetails(request.request_id);
    requestsWithDetails.push(details);
  }

  return requestsWithDetails;
}

/**
 * Get pending requests for a specific approver role
 *
 * @param userRole - Role of the approver
 * @returns List of pending requests at the approver's step
 */
export async function getPendingForApprover(userRole: string): Promise<RequestWithDetails[]> {
  // Map role to step number
  const stepNo = ROLE_STEP_MAP[userRole];

  if (!stepNo) {
    throw new Error(`Invalid approver role: ${userRole}`);
  }

  const [requests] = await query<RowDataPacket[]>(
    `SELECT r.*, u.citizen_id as requester_citizen_id, u.role as requester_role
     FROM pts_requests r
     JOIN users u ON r.user_id = u.user_id
     WHERE r.status = ? AND r.current_step = ?
     ORDER BY r.submitted_at ASC`,
    [RequestStatus.PENDING, stepNo]
  );

  const requestsWithDetails: RequestWithDetails[] = [];

  for (const request of requests as any[]) {
    const details = await getRequestDetails(request.request_id);
    details.requester = {
      citizen_id: request.requester_citizen_id,
      role: request.requester_role,
    };
    requestsWithDetails.push(details);
  }

  return requestsWithDetails;
}

/**
 * Get full request details by ID with access control
 *
 * @param requestId - Request ID
 * @param userId - User ID requesting access
 * @param userRole - User role for permission checking
 * @returns Request with full details
 */
export async function getRequestById(
  requestId: number,
  userId: number,
  userRole: string
): Promise<RequestWithDetails> {
  const [requests] = await query<RowDataPacket[]>(
    `SELECT r.*, u.citizen_id as requester_citizen_id, u.role as requester_role
     FROM pts_requests r
     JOIN users u ON r.user_id = u.user_id
     WHERE r.request_id = ?`,
    [requestId]
  );

  if (requests.length === 0) {
    throw new Error('Request not found');
  }

  const request = requests[0] as any;

  // Check access: owner OR appropriate approver OR admin
  const isOwner = request.user_id === userId;
  const isApprover =
    ROLE_STEP_MAP[userRole] !== undefined &&
    request.status === RequestStatus.PENDING &&
    request.current_step === ROLE_STEP_MAP[userRole];
  const isAdmin = userRole === 'ADMIN';

  if (!isOwner && !isApprover && !isAdmin) {
    throw new Error('You do not have permission to view this request');
  }

  const details = await getRequestDetails(requestId);
  details.requester = {
    citizen_id: request.requester_citizen_id,
    role: request.requester_role,
  };

  return details;
}

/**
 * Approve a request and move it to the next step
 *
 * @param requestId - Request ID to approve
 * @param actorId - User ID of the approver
 * @param actorRole - Role of the approver
 * @param comment - Optional approval comment
 * @returns Updated request
 */
export async function approveRequest(
  requestId: number,
  actorId: number,
  actorRole: string,
  comment?: string
): Promise<PTSRequest> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Get current request
    const [requests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId]
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = requests[0] as PTSRequest;

    // Validate status is PENDING
    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot approve request with status: ${request.status}`);
    }

    // Validate approver role matches current step
    const expectedRole = STEP_ROLE_MAP[request.current_step];
    if (expectedRole !== actorRole) {
      throw new Error(
        `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`
      );
    }

    const currentStep = request.current_step;
    const nextStep = currentStep + 1;

    // Log APPROVE action
    await connection.execute(
      `INSERT INTO pts_request_actions
       (request_id, actor_id, action_type, from_step, to_step, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [requestId, actorId, ActionType.APPROVE, currentStep, nextStep, comment || null]
    );

    // Check if this is the final approval step
    if (nextStep > 5) {
      // All approvals completed - mark as APPROVED
      await connection.execute(
        `UPDATE pts_requests
         SET status = ?, current_step = ?, updated_at = NOW()
         WHERE request_id = ?`,
        [RequestStatus.APPROVED, 6, requestId]
      );
    } else {
      // Move to next approval step
      await connection.execute(
        `UPDATE pts_requests
         SET current_step = ?, updated_at = NOW()
         WHERE request_id = ?`,
        [nextStep, requestId]
      );
    }

    await connection.commit();

    // Fetch and return updated request
    const [updatedRequests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId]
    );

    return updatedRequests[0] as PTSRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Reject a request and stop the workflow
 *
 * @param requestId - Request ID to reject
 * @param actorId - User ID of the rejector
 * @param actorRole - Role of the rejector
 * @param comment - Required rejection reason
 * @returns Updated request
 */
export async function rejectRequest(
  requestId: number,
  actorId: number,
  actorRole: string,
  comment: string
): Promise<PTSRequest> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Get current request
    const [requests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId]
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = requests[0] as PTSRequest;

    // Validate status is PENDING
    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot reject request with status: ${request.status}`);
    }

    // Validate approver role matches current step
    const expectedRole = STEP_ROLE_MAP[request.current_step];
    if (expectedRole !== actorRole) {
      throw new Error(
        `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`
      );
    }

    // Validate comment is provided
    if (!comment || comment.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    const currentStep = request.current_step;

    // Log REJECT action
    await connection.execute(
      `INSERT INTO pts_request_actions
       (request_id, actor_id, action_type, from_step, to_step, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [requestId, actorId, ActionType.REJECT, currentStep, currentStep, comment]
    );

    // Update status to REJECTED
    await connection.execute(
      `UPDATE pts_requests
       SET status = ?, updated_at = NOW()
       WHERE request_id = ?`,
      [RequestStatus.REJECTED, requestId]
    );

    await connection.commit();

    // Fetch and return updated request
    const [updatedRequests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId]
    );

    return updatedRequests[0] as PTSRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Return a request to the previous step for revision
 *
 * @param requestId - Request ID to return
 * @param actorId - User ID of the returner
 * @param actorRole - Role of the returner
 * @param comment - Required reason for returning
 * @returns Updated request
 */
export async function returnRequest(
  requestId: number,
  actorId: number,
  actorRole: string,
  comment: string
): Promise<PTSRequest> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Get current request
    const [requests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId]
    );

    if (requests.length === 0) {
      throw new Error('Request not found');
    }

    const request = requests[0] as PTSRequest;

    // Validate status is PENDING
    if (request.status !== RequestStatus.PENDING) {
      throw new Error(`Cannot return request with status: ${request.status}`);
    }

    // Validate step > 1 (cannot return from first step)
    if (request.current_step <= 1) {
      throw new Error('Cannot return request from the first approval step');
    }

    // Validate approver role matches current step
    const expectedRole = STEP_ROLE_MAP[request.current_step];
    if (expectedRole !== actorRole) {
      throw new Error(
        `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`
      );
    }

    // Validate comment is provided
    if (!comment || comment.trim() === '') {
      throw new Error('Return reason is required');
    }

    const currentStep = request.current_step;
    const previousStep = currentStep - 1;

    // Log RETURN action
    await connection.execute(
      `INSERT INTO pts_request_actions
       (request_id, actor_id, action_type, from_step, to_step, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [requestId, actorId, ActionType.RETURN, currentStep, previousStep, comment]
    );

    // Update to RETURNED status and decrement step
    await connection.execute(
      `UPDATE pts_requests
       SET status = ?, current_step = ?, updated_at = NOW()
       WHERE request_id = ?`,
      [RequestStatus.RETURNED, previousStep, requestId]
    );

    await connection.commit();

    // Fetch and return updated request
    const [updatedRequests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM pts_requests WHERE request_id = ?',
      [requestId]
    );

    return updatedRequests[0] as PTSRequest;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Helper function to get request details including attachments and actions
 *
 * @param requestId - Request ID
 * @returns Request with full details
 */
async function getRequestDetails(requestId: number): Promise<RequestWithDetails> {
  // Get request
  const [requests] = await query<RowDataPacket[]>(
    'SELECT * FROM pts_requests WHERE request_id = ?',
    [requestId]
  );

  if (requests.length === 0) {
    throw new Error('Request not found');
  }

  const request = requests[0] as PTSRequest;

  // Get attachments
  const [attachments] = await query<RowDataPacket[]>(
    'SELECT * FROM pts_attachments WHERE request_id = ? ORDER BY uploaded_at DESC',
    [requestId]
  );

  // Get actions with actor info
  const [actions] = await query<RowDataPacket[]>(
    `SELECT a.*, u.citizen_id as actor_citizen_id, u.role as actor_role
     FROM pts_request_actions a
     JOIN users u ON a.actor_id = u.user_id
     WHERE a.request_id = ?
     ORDER BY a.created_at ASC`,
    [requestId]
  );

  const actionsWithActor = (actions as any[]).map((action) => ({
    action_id: action.action_id,
    request_id: action.request_id,
    actor_id: action.actor_id,
    action_type: action.action_type,
    from_step: action.from_step,
    to_step: action.to_step,
    comment: action.comment,
    created_at: action.created_at,
    actor: {
      citizen_id: action.actor_citizen_id,
      role: action.actor_role,
    },
  }));

  return {
    ...request,
    attachments: attachments as RequestAttachment[],
    actions: actionsWithActor,
  };
}

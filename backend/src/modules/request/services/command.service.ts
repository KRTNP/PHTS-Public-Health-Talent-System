/**
 * Request Module - Command Service
 *
 * Create and submit operations for requests
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { query, getConnection } from '../../../config/database.js';
import {
  RequestStatus,
  ActionType,
  FileType,
  PTSRequest,
  CreateRequestDTO,
  RequestWithDetails,
} from '../request.types.js';
import { NotificationService } from '../../notification/notification.service.js';
import { findRecommendedRate, MasterRate } from '../classification/classification.service.js';
import { saveSignature } from '../../signature/signature.service.js';
import {
  generateRequestNo,
  normalizeDateToYMD,
  mapRequestRow,
  getRequestLinkForRole,
} from './helpers.js';
import { getRequestDetails } from './query.service.js';

// ============================================================================
// Get Recommended Rate
// ============================================================================

export async function getRecommendedRateForUser(userId: number): Promise<MasterRate | null> {
  const users = await query<RowDataPacket[]>(
    'SELECT citizen_id FROM users WHERE id = ? LIMIT 1',
    [userId],
  );

  if (!users || users.length === 0) {
    throw new Error('User not found');
  }

  const citizenId = users[0].citizen_id as string;
  return await findRecommendedRate(citizenId);
}

// ============================================================================
// Create Request (DRAFT)
// ============================================================================

export async function createRequest(
  userId: number,
  data: CreateRequestDTO,
  files?: Express.Multer.File[],
  signatureFile?: Express.Multer.File,
): Promise<RequestWithDetails> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Get citizen_id for the user
    const [userRows] = await connection.query<RowDataPacket[]>(
      'SELECT citizen_id FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    if (!userRows.length) {
      throw new Error('User not found');
    }
    const citizenId = userRows[0].citizen_id as string;

    // Handle signature
    let signatureId: number | null = null;
    if (signatureFile) {
      if (!signatureFile.buffer || signatureFile.buffer.length === 0) {
        throw new Error('Signature upload is missing data');
      }
      signatureId = await saveSignature(userId, signatureFile.buffer, connection);
    } else {
      const [sigs] = await connection.query<RowDataPacket[]>(
        'SELECT signature_id FROM sig_images WHERE user_id = ?',
        [userId],
      );
      signatureId = sigs.length ? sigs[0].signature_id : null;
    }

    if (!signatureId) {
      throw new Error('ไม่พบข้อมูลลายเซ็น กรุณาเซ็นชื่อก่อนยื่นคำขอ');
    }

    // Serialize JSON payloads
    const workAttributesJson = data.work_attributes ? JSON.stringify(data.work_attributes) : null;
    const submissionDataJson = data.submission_data
      ? JSON.stringify({ ...data.submission_data, main_duty: data.main_duty ?? null })
      : data.main_duty
        ? JSON.stringify({ main_duty: data.main_duty })
        : null;

    // Validate mandatory fields
    if (data.requested_amount === undefined || data.requested_amount === null) {
      throw new Error('requested_amount is required');
    }
    const effectiveDateStr = normalizeDateToYMD(data.effective_date as string | Date);

    // Insert request
    const requestNo = generateRequestNo();
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO req_submissions
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

    // Insert attachments
    if (files && files.length > 0) {
      for (const file of files) {
        let fileType = FileType.OTHER;
        if (file.fieldname === 'license_file') fileType = FileType.LICENSE;

        await connection.execute<ResultSetHeader>(
          `INSERT INTO req_attachments
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

// ============================================================================
// Submit Request
// ============================================================================

export async function submitRequest(requestId: number, userId: number): Promise<PTSRequest> {
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM req_submissions WHERE request_id = ? AND user_id = ?',
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
      `UPDATE req_submissions
       SET status = ?, current_step = ?, updated_at = NOW()
       WHERE request_id = ?`,
      [RequestStatus.PENDING, 1, requestId],
    );

    await connection.execute(
      `INSERT INTO req_approvals
       (request_id, actor_id, step_no, action, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [requestId, userId, 1, ActionType.SUBMIT, null],
    );

    await connection.commit();

    await NotificationService.notifyRole(
      'HEAD_WARD',
      'มีคำขอใหม่รออนุมัติ',
      `มีคำขอเลขที่ ${request.request_no} รอการตรวจสอบจากท่าน`,
      getRequestLinkForRole('HEAD_WARD', requestId),
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

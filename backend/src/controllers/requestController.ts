/**
 * PHTS System - Request Controller
 *
 * HTTP handlers for PTS request management endpoints
 *
 * Date: 2025-12-30
 */

import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { ApiResponse } from '../types/auth.js';
import {
  RequestType,
  PTSRequest,
  RequestWithDetails,
  PersonnelType,
  CreateRequestDTO,
  BatchApproveResult,
} from '../types/request.types.js';
import * as requestService from '../services/requestService.js';
import {
  classifyEmployee,
  findRecommendedRate,
  getAllActiveMasterRates,
} from '../services/classificationService.js';
import { handleUploadError } from '../config/upload.js';
import pool from '../config/database.js';
import { NotificationService } from '../services/notificationService.js';
import fs from 'fs';

/**
 * Create a new PTS request
 *
 * @route POST /api/requests
 * @access Protected
 */
export async function createRequest(
  req: Request,
  res: Response<ApiResponse<RequestWithDetails>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const {
      personnel_type,
      position_number,
      department_group,
      main_duty,
      work_attributes,
      request_type,
      requested_amount,
      effective_date,
      submission_data,
    } = req.body;

    // Validate required fields
    if (!personnel_type || !request_type) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: personnel_type and request_type',
      });
      return;
    }

    // Validate personnel_type is valid enum value
    if (!Object.values(PersonnelType).includes(personnel_type)) {
      res.status(400).json({
        success: false,
        error: `Invalid personnel_type. Must be one of: ${Object.values(PersonnelType).join(', ')}`,
      });
      return;
    }

    // Validate request_type is valid enum value
    if (!Object.values(RequestType).includes(request_type)) {
      res.status(400).json({
        success: false,
        error: `Invalid request_type. Must be one of: ${Object.values(RequestType).join(', ')}`,
      });
      return;
    }

    // Parse work_attributes if it's a string
    let parsedWorkAttributes;
    if (work_attributes) {
      try {
        parsedWorkAttributes =
          typeof work_attributes === 'string' ? JSON.parse(work_attributes) : work_attributes;
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid work_attributes format. Must be valid JSON.',
        });
        return;
      }
    }

    // Parse submission_data if it's a string (for backward compatibility)
    let parsedSubmissionData;
    if (submission_data) {
      try {
        parsedSubmissionData =
          typeof submission_data === 'string' ? JSON.parse(submission_data) : submission_data;
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid submission_data format. Must be valid JSON.',
        });
        return;
      }
    }

    // Build DTO
    const requestData: CreateRequestDTO = {
      personnel_type: personnel_type as PersonnelType,
      position_number,
      department_group,
      main_duty,
      work_attributes: parsedWorkAttributes,
      request_type: request_type as RequestType,
      requested_amount: requested_amount ? parseFloat(requested_amount) : undefined,
      effective_date,
      submission_data: parsedSubmissionData,
    };

    const [empRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM pts_employees WHERE citizen_id = ?`,
      [req.user.citizenId],
    );

    if (!empRows.length) {
      res.status(404).json({
        success: false,
        error: 'Employee not found',
      });
      return;
    }

    const classification = await classifyEmployee(empRows[0] as any);
    if (!classification) {
      res.status(400).json({
        success: false,
        error: 'Unable to classify employee',
      });
      return;
    }
    requestData.requested_amount = classification.rate_amount;

    // ใช้ยอดเงินที่ส่งมาจาก Frontend (หรือ 0) แทนการคำนวณ
    if (requestData.requested_amount === undefined) {
      requestData.requested_amount = 0;
    }

    // Get uploaded files (documents) and optional signature upload
    let documentFiles: Express.Multer.File[] = [];
    let signatureFile: Express.Multer.File | undefined;
    if (req.files) {
      const uploadedFiles = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (uploadedFiles['files']) {
        documentFiles = [...documentFiles, ...uploadedFiles['files']];
      }
      if (uploadedFiles['license_file']) {
        documentFiles = [...documentFiles, ...uploadedFiles['license_file']];
      }
      signatureFile = uploadedFiles['applicant_signature']?.[0];
    }

    // Create request
    const request = await requestService.createRequest(
      req.user.userId,
      requestData,
      documentFiles,
      signatureFile,
    );

    await NotificationService.notifyUser(
      req.user.userId,
      'ส่งคำขอสำเร็จ',
      `คำขอ พ.ต.ส. ของคุณถูกส่งแล้ว (รหัส ${request.request_id})`,
      `/dashboard/user/requests/${request.request_id}`,
      'INFO',
    );

    res.status(201).json({
      success: true,
      data: request,
      message: 'Request created successfully',
    });
  } catch (error: any) {
    console.error('Create request error:', error);

    // Cleanup uploaded files on failure
    if (req.files) {
      const uploadedFiles = req.files as { [fieldname: string]: Express.Multer.File[] };
      Object.values(uploadedFiles)
        .flat()
        .forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkError) {
            console.error(`Failed to delete file ${file.path}:`, unlinkError);
          }
        });
    }

    // Handle file upload errors
    const uploadError = handleUploadError(error);
    if (uploadError !== 'An error occurred during file upload') {
      res.status(400).json({
        success: false,
        error: uploadError,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while creating the request',
    });
  }
}

/**
 * Submit a draft request to start approval workflow
 *
 * @route POST /api/requests/:id/submit
 * @access Protected
 */
export async function submitRequest(
  req: Request,
  res: Response<ApiResponse<PTSRequest>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const request = await requestService.submitRequest(requestId, req.user.userId);

    res.status(200).json({
      success: true,
      data: request,
      message: 'Request submitted successfully',
    });
  } catch (error: any) {
    console.error('Submit request error:', error);

    const statusCode =
      error.message.includes('not found') || error.message.includes('permission')
        ? 404
        : error.message.includes('Cannot submit')
          ? 400
          : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while submitting the request',
    });
  }
}

/**
 * Get all requests created by the current user
 *
 * @route GET /api/requests
 * @access Protected
 */
export async function getMyRequests(
  req: Request,
  res: Response<ApiResponse<RequestWithDetails[]>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requests = await requestService.getMyRequests(req.user.userId);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error('Get my requests error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while fetching your requests',
    });
  }
}

/**
 * Get pending requests for approval by current user's role
 *
 * @route GET /api/requests/pending
 * @access Protected (Approvers only)
 */
export async function getPendingApprovals(
  req: Request,
  res: Response<ApiResponse<RequestWithDetails[]>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requests = await requestService.getPendingForApprover(req.user.role);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error('Get pending approvals error:', error);

    const statusCode = error.message.includes('Invalid approver role') ? 403 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while fetching pending approvals',
    });
  }
}

/**
 * Get approval history for the current approver
 *
 * @route GET /api/requests/history
 * @access Protected (Approvers only)
 */
export async function getHistory(
  req: Request,
  res: Response<ApiResponse<RequestWithDetails[]>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const history = await requestService.getApprovalHistory(req.user.userId);

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    console.error('Get approval history error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while fetching approval history',
    });
  }
}

/**
 * Get request details by ID
 *
 * @route GET /api/requests/:id
 * @access Protected
 */
export async function getRequestById(
  req: Request,
  res: Response<ApiResponse<RequestWithDetails>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const request = await requestService.getRequestById(requestId, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error: any) {
    console.error('Get request by ID error:', error);

    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('permission')
        ? 403
        : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while fetching the request',
    });
  }
}

/**
 * Approve a request
 *
 * @route POST /api/requests/:id/approve
 * @access Protected (Approvers only)
 */
export async function approveRequest(
  req: Request,
  res: Response<ApiResponse<PTSRequest>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const { comment } = req.body;

    const request = await requestService.approveRequest(
      requestId,
      req.user.userId,
      req.user.role,
      comment,
    );

    await NotificationService.notifyUser(
      request.user_id,
      'อนุมัติคำขอแล้ว',
      `คำขอ พ.ต.ส. ของคุณได้รับการอนุมัติ (รหัส ${request.request_id})`,
      `/dashboard/user/requests/${request.request_id}`,
      'INFO',
    );

    res.status(200).json({
      success: true,
      data: request,
      message: 'Request approved successfully',
    });
  } catch (error: any) {
    console.error('Approve request error:', error);

    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('Invalid approver') || error.message.includes('Cannot approve')
        ? 403
        : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while approving the request',
    });
  }
}

/**
 * Reject a request
 *
 * @route POST /api/requests/:id/reject
 * @access Protected (Approvers only)
 */
export async function rejectRequest(
  req: Request,
  res: Response<ApiResponse<PTSRequest>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Rejection reason (comment) is required',
      });
      return;
    }

    const request = await requestService.rejectRequest(
      requestId,
      req.user.userId,
      req.user.role,
      comment,
    );

    res.status(200).json({
      success: true,
      data: request,
      message: 'Request rejected successfully',
    });
  } catch (error: any) {
    console.error('Reject request error:', error);

    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('Invalid approver') || error.message.includes('Cannot reject')
        ? 403
        : error.message.includes('required')
          ? 400
          : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while rejecting the request',
    });
  }
}

/**
 * Return a request to previous step
 *
 * @route POST /api/requests/:id/return
 * @access Protected (Approvers only)
 */
export async function returnRequest(
  req: Request,
  res: Response<ApiResponse<PTSRequest>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestId = parseInt(req.params.id, 10);

    if (isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      res.status(400).json({
        success: false,
        error: 'Return reason (comment) is required',
      });
      return;
    }

    const request = await requestService.returnRequest(
      requestId,
      req.user.userId,
      req.user.role,
      comment,
    );

    res.status(200).json({
      success: true,
      data: request,
      message: 'Request returned to previous step successfully',
    });
  } catch (error: any) {
    console.error('Return request error:', error);

    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('Invalid approver') || error.message.includes('Cannot return')
        ? 403
        : error.message.includes('required')
          ? 400
          : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'An error occurred while returning the request',
    });
  }
}

/**
 * Batch approve multiple requests (DIRECTOR or HEAD_FINANCE)
 *
 * Supports batch approval for:
 * - DIRECTOR at Step 4: Moves requests to Step 5 (HEAD_FINANCE)
 * - HEAD_FINANCE at Step 5: Marks requests as APPROVED and triggers finalization
 *
 * @route POST /api/requests/batch-approve
 * @access Protected (DIRECTOR or HEAD_FINANCE only)
 */
export async function approveBatch(
  req: Request,
  res: Response<ApiResponse<BatchApproveResult>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    // Validate user is DIRECTOR or HEAD_FINANCE
    const allowedRoles = ['DIRECTOR', 'HEAD_FINANCE'];
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Only DIRECTOR or HEAD_FINANCE can perform batch approval',
      });
      return;
    }

    const { requestIds, comment } = req.body;

    // Validate requestIds is array
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      res.status(400).json({
        success: false,
        error: 'requestIds must be a non-empty array',
      });
      return;
    }

    // Validate all requestIds are numbers
    const invalidIds = requestIds.filter((id) => typeof id !== 'number' || isNaN(id));
    if (invalidIds.length > 0) {
      res.status(400).json({
        success: false,
        error: 'All requestIds must be valid numbers',
      });
      return;
    }

    const result = await requestService.approveBatch(req.user.userId, req.user.role, {
      requestIds,
      comment,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `Batch approval completed: ${result.success.length} approved, ${result.failed.length} failed`,
    });
  } catch (error: any) {
    console.error('Batch approval error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred during batch approval',
    });
  }
}

/**
 * Get recommended rate for the current user (or specified citizen_id)
 */
export async function getRecommendedRate(req: Request, res: Response): Promise<void> {
  try {
    const citizenId = (req as any).user?.citizenId || req.query.citizen_id;

    if (!citizenId || typeof citizenId !== 'string') {
      res.status(400).json({ error: 'Citizen ID is required' });
      return;
    }

    const rate = await findRecommendedRate(citizenId);

    if (!rate) {
      res
        .status(404)
        .json({ message: 'ไม่พบข้อมูลการจัดกลุ่มสำหรับตำแหน่งนี้ หรือข้อมูลไม่เพียงพอ' });
      return;
    }

    res.json({ success: true, data: rate });
  } catch (error: any) {
    console.error('Error fetching recommended rate:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Pre-classification info for current user
 */
export async function getPreClassification(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user?.citizenId) {
      res.status(401).json({ success: false, error: 'Unauthorized access' });
      return;
    }

    // Auto-detect data source: pts_employees (test) or employees view (production/HRMS sync)
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.DB_NAME?.includes('test');
    const dataSource = isTestEnv ? 'pts_employees' : 'employees';
    const startDateField = isTestEnv ? 'start_work_date' : 'start_current_position';

    const [empRows] = await pool.query<RowDataPacket[]>(
      `SELECT
        citizen_id,
        position_name,
        specialist,
        expert,
        sub_department,
        ${startDateField} as start_work_date
       FROM ${dataSource} WHERE citizen_id = ?`,
      [user.citizenId],
    );

    if (empRows.length === 0) {
      // Return graceful response instead of 404 when employee record is not found
      // This allows users to still fill out the form manually
      console.warn(`Employee record not found for citizen_id: ${user.citizenId}`);
      res.json({
        success: true,
        data: {
          group_name: 'ไม่พบข้อมูลพนักงาน - กรุณากรอกข้อมูลเอง',
          rate_amount: 0,
          criteria_text: 'กรุณากรอกข้อมูลและระบุจำนวนเงินที่ขอรับด้วยตนเอง',
          start_work_date: null,
          position_name: null,
        },
      });
      return;
    }

    const employee = empRows[0] as any;

    const classification = await classifyEmployee(employee);
    if (!classification) {
      // Return graceful response if classification fails
      res.json({
        success: true,
        data: {
          group_name: 'ไม่สามารถจำแนกสิทธิ์อัตโนมัติได้ - กรุณาระบุเอง',
          rate_amount: 0,
          criteria_text: 'กรุณากรอกข้อมูลและระบุจำนวนเงินที่ขอรับด้วยตนเอง',
          start_work_date: employee.start_work_date || null,
          position_name: employee.position_name || null,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...classification,
        start_work_date: employee.start_work_date,
        position_name: employee.position_name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Error calculating classification' });
  }
}

/**
 * Unified process action (APPROVE, REJECT, RETURN)
 */
export async function processAction(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized access' });
      return;
    }

    const requestId = parseInt(req.params.id, 10);
    if (Number.isNaN(requestId)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    const { action, comment } = req.body as { action: string; comment?: string };
    if (!['APPROVE', 'REJECT', 'RETURN'].includes(action)) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    let result: any;
    if (action === 'APPROVE') {
      result = await requestService.approveRequest(
        requestId,
        req.user.userId,
        req.user.role,
        comment,
      );
    } else if (action === 'REJECT') {
      result = await requestService.rejectRequest(
        requestId,
        req.user.userId,
        req.user.role,
        comment || '',
      );
    } else {
      result = await requestService.returnRequest(
        requestId,
        req.user.userId,
        req.user.role,
        comment || '',
      );
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Process action error:', error);
    res.status(400).json({ error: error.message });
  }
}

/**
 * Get all active master rates
 */
export async function getMasterRates(_req: Request, res: Response): Promise<void> {
  try {
    const rates = await getAllActiveMasterRates();
    res.json({ success: true, data: rates });
  } catch (error: any) {
    console.error('Get master rates error:', error);
    res.status(500).json({ error: error.message });
  }
}

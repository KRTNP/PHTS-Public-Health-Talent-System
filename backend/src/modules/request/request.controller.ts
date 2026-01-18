/**
 * PHTS System - Request Controller
 *
 * HTTP handlers for PTS request management endpoints
 *
 * Date: 2025-12-30
 */

import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2/promise';
import { ApiResponse, JwtPayload } from '../../types/auth.js';
import {
  RequestType,
  PTSRequest,
  RequestWithDetails,
  PersonnelType,
  CreateRequestDTO,
  BatchApproveResult,
} from './request.types.js';
import * as requestService from './request.service.js';
import { getUserScopesForDisplay } from './scope/scope.service.js';
import {
  classifyEmployee,
  findRecommendedRate,
  getAllActiveMasterRates,
} from './classification/classification.service.js';
import { handleUploadError, MAX_SIGNATURE_SIZE } from '../../config/upload.js';
import pool from '../../config/database.js';
import { NotificationService } from '../notification/notification.service.js';
import fs from 'node:fs';
import path from 'node:path';

type StatusRule = Readonly<{
  matches: (message: string) => boolean;
  code: number;
}>;

const resolveStatusCode = (
  message: string | undefined,
  rules: StatusRule[],
  defaultCode = 500,
) => {
  if (!message) return defaultCode;
  for (const rule of rules) {
    if (rule.matches(message)) return rule.code;
  }
  return defaultCode;
};

const parseJsonField = <T>(value: unknown, fieldName: string): T | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`Failed to parse ${fieldName}`, error);
      throw new Error(`Invalid ${fieldName} format. Must be valid JSON.`);
    }
  }
  return value as T;
};

const validateCreateRequestBody = (body: Record<string, unknown>): string | null => {
  const personnelType = body.personnel_type;
  const requestType = body.request_type;
  if (!personnelType || !requestType) {
    return 'Missing required fields: personnel_type and request_type';
  }
  if (!Object.values(PersonnelType).includes(personnelType as PersonnelType)) {
    return `Invalid personnel_type. Must be one of: ${Object.values(PersonnelType).join(', ')}`;
  }
  if (!Object.values(RequestType).includes(requestType as RequestType)) {
    return `Invalid request_type. Must be one of: ${Object.values(RequestType).join(', ')}`;
  }
  return null;
};

const buildCreateRequestData = (
  body: Record<string, unknown>,
  res: Response<ApiResponse<RequestWithDetails>>,
): CreateRequestDTO | null => {
  const validationError = validateCreateRequestBody(body);
  if (validationError) {
    res.status(400).json({
      success: false,
      error: validationError,
    });
    return null;
  }

  let parsedWorkAttributes;
  let parsedSubmissionData;
  try {
    parsedWorkAttributes = parseJsonField(body.work_attributes, 'work_attributes');
    parsedSubmissionData = parseJsonField(body.submission_data, 'submission_data');
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid request payload',
    });
    return null;
  }

  const parsedRequestedAmount = parseRequestedAmount(body.requested_amount);

  return {
    personnel_type: body.personnel_type as PersonnelType,
    position_number: body.position_number as string,
    department_group: body.department_group as string,
    main_duty: body.main_duty as string,
    work_attributes: parsedWorkAttributes as CreateRequestDTO['work_attributes'],
    request_type: body.request_type as RequestType,
    requested_amount: parsedRequestedAmount,
    effective_date: body.effective_date as string,
    submission_data: parsedSubmissionData as CreateRequestDTO['submission_data'],
  };
};

const parseRequestedAmount = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

function normalizeScopeParam(scope: unknown): string | undefined {
  if (typeof scope !== 'string') return undefined;
  const trimmed = scope.trim();
  if (!trimmed || trimmed.length > 120) return undefined;
  if (!/^[\p{L}\p{N}\s._\-()/]+$/u.test(trimmed)) return undefined;
  return trimmed;
}

const DOCUMENT_UPLOAD_ROOT = path.join(process.cwd(), 'uploads/documents');
const UPLOAD_SESSION_REGEX = /^[a-f0-9-]{36}$/i;

function cleanupUploadSession(req: Request): void {
  const sessionId = req.uploadSessionId;
  if (!sessionId || !UPLOAD_SESSION_REGEX.test(sessionId)) return;

  const resolvedRoot = path.resolve(DOCUMENT_UPLOAD_ROOT);
  const resolvedTarget = path.resolve(path.join(DOCUMENT_UPLOAD_ROOT, sessionId));

  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    return;
  }

  try {
    fs.rmSync(resolvedTarget, { recursive: true, force: true });
  } catch (error) {
    console.error('Failed to cleanup upload session directory', {
      sessionId,
      error: error instanceof Error ? error.message : error,
    });
  }
}

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
  let documentFiles: Express.Multer.File[] = [];
  let signatureFile: Express.Multer.File | undefined;

  try {
    const user = req.user as JwtPayload | undefined;
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const requestData = buildCreateRequestData(req.body, res);
    if (!requestData) {
      return;
    }

    const [empRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM emp_profiles WHERE citizen_id = ?`,
      [user.citizenId],
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
    requestData.requested_amount ??= 0;

    // Get uploaded files (documents) and optional signature upload
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

    if (signatureFile && signatureFile.size > MAX_SIGNATURE_SIZE) {
      cleanupUploadSession(req);
      res.status(400).json({
        success: false,
        error: `Signature file exceeds ${MAX_SIGNATURE_SIZE / 1024 / 1024}MB limit`,
      });
      return;
    }

    // Create request
    const request = await requestService.createRequest(
      user.userId,
      requestData,
      documentFiles,
      signatureFile,
    );

    await NotificationService.notifyUser(
      user.userId,
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

    cleanupUploadSession(req);

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

    const requestId = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(requestId)) {
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

    const statusCode = resolveStatusCode(error.message, [
      {
        matches: (message) =>
          message.includes('not found') || message.includes('permission'),
        code: 404,
      },
      { matches: (message) => message.includes('Cannot submit'), code: 400 },
    ]);

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
 * For HEAD_WARD and HEAD_DEPT, requests are filtered by scope.
 * Optional query param `scope` to filter to a specific scope.
 *
 * @route GET /api/requests/pending?scope=optional
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

    // Optional scope filter for multi-scope users
    const selectedScope = normalizeScopeParam(req.query.scope);
    if (req.query.scope !== undefined && !selectedScope) {
      res.status(400).json({
        success: false,
        error: 'Invalid scope filter',
      });
      return;
    }

    // Pass userId and optional selectedScope for scope-based filtering
    const requests = await requestService.getPendingForApprover(
      req.user.role,
      req.user.userId,
      selectedScope,
    );

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
 * Get user's available scopes for multi-scope dropdown
 *
 * @route GET /api/requests/my-scopes
 * @access Protected (HEAD_WARD, HEAD_DEPT only)
 */
export async function getMyScopes(
  req: Request,
  res: Response<ApiResponse<{ value: string; label: string; type: 'UNIT' | 'DEPT' }[]>>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const scopes = await getUserScopesForDisplay(req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      data: scopes,
    });
  } catch (error: any) {
    console.error('Get my scopes error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while fetching scopes',
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

    const requestId = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(requestId)) {
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

    const statusCode = resolveStatusCode(error.message, [
      { matches: (message) => message.includes('not found'), code: 404 },
      { matches: (message) => message.includes('permission'), code: 403 },
    ]);

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

    const requestId = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(requestId)) {
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

    const statusCode = resolveStatusCode(error.message, [
      { matches: (message) => message.includes('not found'), code: 404 },
      {
        matches: (message) =>
          message.includes('Invalid approver') ||
          message.includes('Cannot approve') ||
          message.includes('scope access') ||
          message.includes('Self-approval'),
        code: 403,
      },
    ]);

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

    const requestId = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const { comment } = req.body;
    if (typeof comment !== 'string' || comment.trim() === '') {
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

    const statusCode = resolveStatusCode(error.message, [
      { matches: (message) => message.includes('not found'), code: 404 },
      {
        matches: (message) =>
          message.includes('Invalid approver') ||
          message.includes('Cannot reject') ||
          message.includes('scope access'),
        code: 403,
      },
      { matches: (message) => message.includes('required'), code: 400 },
    ]);

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

    const requestId = Number.parseInt(req.params.id, 10);

    if (Number.isNaN(requestId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid request ID',
      });
      return;
    }

    const { comment } = req.body;
    if (typeof comment !== 'string' || comment.trim() === '') {
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

    const statusCode = resolveStatusCode(error.message, [
      { matches: (message) => message.includes('not found'), code: 404 },
      {
        matches: (message) =>
          message.includes('Invalid approver') ||
          message.includes('Cannot return') ||
          message.includes('scope access'),
        code: 403,
      },
      { matches: (message) => message.includes('required'), code: 400 },
    ]);

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
    const invalidIds = requestIds.filter((id) => typeof id !== 'number' || Number.isNaN(id));
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

    // Auto-detect data source: emp_profiles (test) or employees view (production/HRMS sync)
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.DB_NAME?.includes('test');
    const dataSource = isTestEnv ? 'emp_profiles' : 'employees';
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

    const requestId = Number.parseInt(req.params.id, 10);
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

// ============================================
// Reassign Functions (PTS_OFFICER)
// ============================================
import * as reassignService from './reassign/reassign.service.js';
import * as ocrService from './ocr/ocr.service.js';

/**
 * Get list of PTS_OFFICER users for reassignment
 *
 * @route GET /api/requests/officers
 * @access Protected (PTS_OFFICER only)
 */
export async function getAvailableOfficers(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized access' });
      return;
    }

    const officers = await reassignService.getAvailableOfficers(req.user.userId);
    res.json({ success: true, data: officers });
  } catch (error: any) {
    console.error('Get available officers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Reassign a request to another PTS_OFFICER
 *
 * @route POST /api/requests/:id/reassign
 * @access Protected (PTS_OFFICER only)
 */
export async function reassignRequest(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized access' });
      return;
    }

    const requestId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(requestId)) {
      res.status(400).json({ success: false, error: 'Invalid request ID' });
      return;
    }

    const { targetOfficerId, reason } = req.body;

    if (!targetOfficerId || typeof targetOfficerId !== 'number') {
      res.status(400).json({ success: false, error: 'targetOfficerId is required' });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      res.status(400).json({ success: false, error: 'Reason for reassignment is required' });
      return;
    }

    const result = await reassignService.reassignRequest(requestId, req.user.userId, {
      targetOfficerId,
      reason,
    });

    res.json({
      success: true,
      data: result,
      message: 'Request reassigned successfully',
    });
  } catch (error: any) {
    console.error('Reassign request error:', error);

    const statusCode = resolveStatusCode(error.message, [
      { matches: (message) => message.includes('not found'), code: 404 },
      {
        matches: (message) =>
          message.includes('Cannot reassign') ||
          message.includes('not at PTS_OFFICER') ||
          message.includes('not a PTS_OFFICER'),
        code: 400,
      },
    ]);

    res.status(statusCode).json({ success: false, error: error.message });
  }
}

/**
 * Get reassignment history for a request
 *
 * @route GET /api/requests/:id/reassign-history
 * @access Protected
 */
export async function getReassignHistory(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized access' });
      return;
    }

    const requestId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(requestId)) {
      res.status(400).json({ success: false, error: 'Invalid request ID' });
      return;
    }

    const history = await reassignService.getReassignmentHistory(requestId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Get reassign history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ============================================
// OCR Functions (PTS_OFFICER)
// ============================================

/**
 * Get OCR record for an attachment
 *
 * @route GET /api/requests/attachments/:attachmentId/ocr
 * @access Protected (PTS_OFFICER only)
 */
export async function getAttachmentOcr(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized access' });
      return;
    }

    const attachmentId = Number.parseInt(req.params.attachmentId, 10);
    if (Number.isNaN(attachmentId)) {
      res.status(400).json({ success: false, error: 'Invalid attachment ID' });
      return;
    }

    await ocrService.assertOcrAccess(attachmentId, req.user.userId);
    const record = await ocrService.getOcrRecord(attachmentId);
    res.json({ success: true, data: record });
  } catch (error: any) {
    console.error('Get attachment OCR error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Request OCR processing for an attachment
 *
 * @route POST /api/requests/attachments/:attachmentId/ocr
 * @access Protected (PTS_OFFICER only)
 */
export async function requestAttachmentOcr(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized access' });
      return;
    }

    const attachmentId = Number.parseInt(req.params.attachmentId, 10);
    if (Number.isNaN(attachmentId)) {
      res.status(400).json({ success: false, error: 'Invalid attachment ID' });
      return;
    }

    await ocrService.assertOcrAccess(attachmentId, req.user.userId);
    const pageNum =
      typeof req.body?.page_num === 'number' ? req.body.page_num : undefined;
    const result = await ocrService.requestOcrProcessing(attachmentId, pageNum);
    res.json({
      success: true,
      data: result.record,
      message: result.ocrEnabled
        ? 'OCR request queued'
        : 'OCR is disabled (set OCR_ENABLED=true after configuring Typhoon OCR)',
    });
  } catch (error: any) {
    console.error('Request attachment OCR error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

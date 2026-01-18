/**
 * Request Module - Helper Functions
 *
 * Shared utilities, SQL fragments, and type mappers
 */

import { randomUUID } from 'crypto';
import { RowDataPacket } from 'mysql2/promise';
import { query } from '../../../config/database.js';
import {
  PTSRequest,
  RequestAttachment,
  RequestWithDetails,
} from '../request.types.js';

// ============================================================================
// SQL Fragments
// ============================================================================

export const REQUESTER_FIELDS = `
  r.*,
  u.citizen_id AS requester_citizen_id,
  u.role AS requester_role,
  COALESCE(e.first_name, s.first_name) AS req_first_name,
  COALESCE(e.last_name, s.last_name) AS req_last_name,
  COALESCE(e.position_name, s.position_name) AS req_position
`;

export const REQUESTER_JOINS = `
  JOIN users u ON r.user_id = u.id
  LEFT JOIN emp_profiles e ON u.citizen_id = e.citizen_id
  LEFT JOIN emp_support_staff s ON u.citizen_id = s.citizen_id
`;

// ============================================================================
// Request Number Generator
// ============================================================================

export function generateRequestNo(): string {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = randomUUID().split('-')[0].substring(0, 4).toUpperCase();
  return `REQ-${datePart}-${randomPart}`;
}

// ============================================================================
// JSON Parser
// ============================================================================

export function parseJsonField<T = unknown>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(value as string) as T;
  } catch {
    return null;
  }
}

// ============================================================================
// Date Normalization
// ============================================================================

export function normalizeDateToYMD(value: string | Date): string {
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

// ============================================================================
// Row Mapper
// ============================================================================

export interface MappedRequest extends PTSRequest {
  request_no?: string;
  applicant_signature_id?: number | null;
}

export function mapRequestRow(row: RowDataPacket): MappedRequest {
  const submissionData = parseJsonField(row.submission_data);
  const workAttributes = parseJsonField(row.work_attributes);
  const mainDuty = row.main_duty ?? (submissionData as Record<string, unknown>)?.main_duty ?? null;

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
  } as MappedRequest;
}

// ============================================================================
// Link Generator
// ============================================================================

export function getRequestLinkForRole(role: string, requestId: number): string {
  switch (role) {
    case 'PTS_OFFICER':
      return `/dashboard/officer/requests/${requestId}`;
    case 'HEAD_HR':
      return `/dashboard/hr-head/requests/${requestId}`;
    case 'USER':
      return `/dashboard/user/requests/${requestId}`;
    case 'HEAD_WARD':
    case 'HEAD_DEPT':
    case 'HEAD_FINANCE':
    case 'DIRECTOR':
    default:
      return `/dashboard/approver/requests/${requestId}`;
  }
}

// ============================================================================
// SQL Utilities
// ============================================================================

export function buildInClause(ids: number[]): { clause: string; params: number[] } {
  const placeholders = ids.map(() => '?').join(', ');
  return { clause: placeholders, params: ids };
}

// ============================================================================
// Request Hydration (Load related data)
// ============================================================================

export async function hydrateRequests(requestRows: RowDataPacket[]): Promise<RequestWithDetails[]> {
  if (!requestRows.length) return [];

  const ids = requestRows.map((row) => row.request_id);
  const { clause, params } = buildInClause(ids);

  const attachments = await query<RowDataPacket[]>(
    `SELECT a.*,
            o.status AS ocr_status,
            o.confidence AS ocr_confidence,
            o.provider AS ocr_provider,
            o.processed_at AS ocr_processed_at
     FROM req_attachments a
     LEFT JOIN req_ocr_results o ON a.attachment_id = o.attachment_id
     WHERE a.request_id IN (${clause})
     ORDER BY a.uploaded_at DESC`,
    params,
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
     WHERE a.request_id IN (${clause})
     ORDER BY a.created_at ASC`,
    params,
  );

  const attachmentsByRequest = new Map<number, RowDataPacket[]>();
  for (const att of attachments) {
    const list = attachmentsByRequest.get(att.request_id) || [];
    list.push(att);
    attachmentsByRequest.set(att.request_id, list);
  }

  const actionsByRequest = new Map<number, RowDataPacket[]>();
  for (const action of actions) {
    const list = actionsByRequest.get(action.request_id) || [];
    list.push(action);
    actionsByRequest.set(action.request_id, list);
  }

  return requestRows.map((row) => {
    const request = mapRequestRow(row) as RequestWithDetails;
    const requestId = row.request_id;

    request.attachments = (attachmentsByRequest.get(requestId) || []).map((att) => ({
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
    })) as RequestAttachment[];

    request.actions = (actionsByRequest.get(requestId) || []).map((action) => ({
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

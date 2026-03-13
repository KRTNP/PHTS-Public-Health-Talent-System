/**
 * PHTS System - Request Management Types
 *
 * Type definitions for PTS request workflow and management
 *
 * Date: 2025-12-30
 */

/**
 * Personnel type category for Thai hospital staff
 */
export enum PersonnelType {
  CIVIL_SERVANT = "CIVIL_SERVANT",
  GOV_EMPLOYEE = "GOV_EMPLOYEE",
  PH_EMPLOYEE = "PH_EMPLOYEE",
  TEMP_EMPLOYEE = "TEMP_EMPLOYEE",
}

/**
 * Request types for different PTS operations
 */
export enum RequestType {
  NEW_ENTRY = "NEW_ENTRY",
  EDIT_INFO_SAME_RATE = "EDIT_INFO_SAME_RATE",
  EDIT_INFO_NEW_RATE = "EDIT_INFO_NEW_RATE",
}

/**
 * Request status tracking throughout the workflow
 */
export enum RequestStatus {
  DRAFT = "DRAFT",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  RETURNED = "RETURNED",
}

/**
 * Action types for request workflow transitions
 */
export enum ActionType {
  SUBMIT = "SUBMIT",
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  RETURN = "RETURN",
  CANCEL = "CANCEL",
  REASSIGN = "REASSIGN",
}

/**
 * File attachment types for request documentation
 */
export enum FileType {
  LICENSE = "LICENSE",
  DIPLOMA = "DIPLOMA",
  ORDER_DOC = "ORDER_DOC",
  SIGNATURE = "SIGNATURE",
  OTHER = "OTHER",
}

export {
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
  TOTAL_APPROVAL_STEPS,
} from '@shared/policy/request.policy.js';

/**
 * Work attributes interface for P.T.S. form
 * Represents the 4 checkboxes for work characteristics
 */
export interface WorkAttributes {
  operation: boolean; // ปฏิบัติการ
  planning: boolean; // วางแผน
  coordination: boolean; // ประสานงาน
  service: boolean; // บริการ
}

/**
 * PTS Request entity from database
 */
export interface PTSRequest {
  request_no?: string;
  request_id: number;
  user_id: number;

  // Personnel Info (new fields from P.T.S. form)
  personnel_type: PersonnelType;
  position_number: string | null;
  department_group: string | null;
  main_duty: string | null;
  work_attributes: WorkAttributes | null;
  applicant_signature?: string | null; // Path to digital signature image (legacy)
  applicant_signature_id?: number | null; // FK to sig_images

  // Request Details
  request_type: RequestType;
  requested_amount: number | null;
  effective_date: Date | null;

  // Workflow
  status: RequestStatus;
  current_step: number;
  submission_data: any; // JSON data specific to request type

  // Timestamps
  created_at: Date;
  updated_at: Date;
  step_started_at?: Date | null;
  submitted_at?: Date | null;

  // Verification snapshot status (for officer flow)
  has_verification_snapshot?: boolean;
}

/**
 * Request action/history entity
 */
export interface RequestAction {
  action_id: number;
  request_id: number;
  actor_id: number;
  // Stored columns
  action: ActionType;
  step_no: number;
  comment: string | null;
  action_date: Date;
  // API-friendly aliases for frontend compatibility
  action_type?: ActionType;
  from_step?: number;
  to_step?: number;
  created_at?: Date;
}

/**
 * File attachment entity
 */
export interface RequestAttachment {
  attachment_id: number;
  request_id: number;
  file_type: FileType | string;
  file_name: string;
  original_filename?: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  uploaded_at: Date;
}

export type DateLike = Date | string | null;
export type RequesterLicenseStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "INACTIVE"
  | "UNKNOWN"
  | null;

/**
 * Extended request with related data
 */
export interface RequestWithDetails extends PTSRequest {
  attachments?: RequestAttachment[];
  actions?: RequestActionWithActor[];
  linked_eligibility?: {
    eligibility_id: number;
    profession_code?: string | null;
    is_active?: boolean;
  } | null;
  ocr_precheck?: {
    request_id: number;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
    source?: string | null;
    service_url?: string | null;
    worker?: string | null;
    queued_at?: DateLike;
    started_at?: DateLike;
    finished_at?: DateLike;
    count?: number | null;
    success_count?: number | null;
    failed_count?: number | null;
    error?: string | null;
    results?: Array<{
      name?: string;
      ok?: boolean;
      markdown?: string;
      error?: string;
    }> | null;
    created_at?: DateLike;
    updated_at?: DateLike;
  } | null;
  latest_verification_snapshot?: {
    snapshot_id: number;
    created_at?: DateLike;
    created_by?: number | null;
    snapshot_data?: Record<string, unknown> | string | null;
  } | null;
  requester?: {
    citizen_id: string;
    role: string;
    first_name?: string;
    last_name?: string;
    position?: string;
    license_no?: string | null;
    license_name?: string | null;
    license_valid_from?: DateLike;
    license_valid_until?: DateLike;
    license_status?: RequesterLicenseStatus;
  };
}

/**
 * Action with actor information
 */
export interface RequestActionWithActor extends RequestAction {
  actor?: {
    citizen_id: string;
    role: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface OcrPrecheckHistoryResult {
  items: Array<{
    request_id: number;
    request_no?: string | null;
    request_status?: string | null;
    request_type?: string | null;
    requester_name?: string | null;
    department?: string | null;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
    source?: string | null;
    service_url?: string | null;
    worker?: string | null;
    queued_at?: DateLike;
    started_at?: DateLike;
    finished_at?: DateLike;
    count?: number | null;
    success_count?: number | null;
    failed_count?: number | null;
    error?: string | null;
    engine_used?: string | null;
    fallback_used?: boolean | null;
    document_kind?: string | null;
    fields?: Record<string, unknown> | null;
    missing_fields?: string[] | null;
    fallback_reason?: string | null;
    quality?: {
      required_fields?: number;
      captured_fields?: number;
      passed?: boolean;
    } | null;
    created_at?: DateLike;
    updated_at?: DateLike;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

// ─── DTOs moved to dto/ directory ───────────────────────────────────────────
// Import from '@/modules/request/dto/index.js' instead:
//   CreateRequestDTO, UpdateRequestDTO, CancelRequestDTO, SubmitRequestDTO,
//   ApproveRequestDTO, RejectRequestDTO, ReturnRequestDTO,
//   BatchApproveParams, BatchApproveResult, RequestFilters, PaginatedResult

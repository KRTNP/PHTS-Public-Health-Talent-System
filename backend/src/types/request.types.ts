/**
 * PHTS System - Request Management Types
 *
 * Type definitions for PTS request workflow and management
 *
 * Date: 2025-12-30
 */

/**
 * Request types for different PTS operations
 */
export enum RequestType {
  NEW_ENTRY = 'NEW_ENTRY',
  EDIT_INFO = 'EDIT_INFO',
  RATE_CHANGE = 'RATE_CHANGE',
}

/**
 * Request status tracking throughout the workflow
 */
export enum RequestStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

/**
 * Action types for request workflow transitions
 */
export enum ActionType {
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  RETURN = 'RETURN',
}

/**
 * File attachment types for request documentation
 */
export enum FileType {
  LICENSE = 'LICENSE',
  DIPLOMA = 'DIPLOMA',
  ORDER_DOC = 'ORDER_DOC',
  OTHER = 'OTHER',
}

/**
 * Step to Role mapping
 * Defines which role is responsible for approval at each workflow step
 */
export const STEP_ROLE_MAP: Record<number, string> = {
  1: 'HEAD_DEPT',
  2: 'PTS_OFFICER',
  3: 'HEAD_HR',
  4: 'DIRECTOR',
  5: 'HEAD_FINANCE',
};

/**
 * Role to Step mapping (reverse)
 * Maps user roles to their corresponding approval step number
 */
export const ROLE_STEP_MAP: Record<string, number> = {
  HEAD_DEPT: 1,
  PTS_OFFICER: 2,
  HEAD_HR: 3,
  DIRECTOR: 4,
  HEAD_FINANCE: 5,
};

/**
 * PTS Request entity from database
 */
export interface PTSRequest {
  request_id: number;
  user_id: number;
  request_type: RequestType;
  status: RequestStatus;
  current_step: number;
  submission_data: any; // JSON data specific to request type
  created_at: Date;
  updated_at: Date;
  submitted_at: Date | null;
}

/**
 * Request action/history entity
 */
export interface RequestAction {
  action_id: number;
  request_id: number;
  actor_id: number;
  action_type: ActionType;
  from_step: number;
  to_step: number;
  comment: string | null;
  created_at: Date;
}

/**
 * File attachment entity
 */
export interface RequestAttachment {
  attachment_id: number;
  request_id: number;
  file_type: FileType;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: Date;
}

/**
 * Extended request with related data
 */
export interface RequestWithDetails extends PTSRequest {
  attachments?: RequestAttachment[];
  actions?: RequestActionWithActor[];
  requester?: {
    citizen_id: string;
    role: string;
  };
}

/**
 * Action with actor information
 */
export interface RequestActionWithActor extends RequestAction {
  actor?: {
    citizen_id: string;
    role: string;
  };
}

/**
 * DTO for creating a new request
 */
export interface CreateRequestDTO {
  request_type: RequestType;
  submission_data: any;
}

/**
 * DTO for submitting a draft request
 */
export interface SubmitRequestDTO {
  requestId: number;
}

/**
 * DTO for approving a request
 */
export interface ApproveRequestDTO {
  comment?: string;
}

/**
 * DTO for rejecting a request
 */
export interface RejectRequestDTO {
  comment: string;
}

/**
 * DTO for returning a request to previous step
 */
export interface ReturnRequestDTO {
  comment: string;
}

/**
 * Filters for querying requests
 */
export interface RequestFilters {
  status?: RequestStatus;
  request_type?: RequestType;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

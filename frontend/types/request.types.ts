/**
 * PHTS System - Request Management Types (Frontend)
 */

/**
 * Personnel type classification for Thai hospital staff
 */
export enum PersonnelType {
  CIVIL_SERVANT = 'CIVIL_SERVANT',
  GOV_EMPLOYEE = 'GOV_EMPLOYEE',
  PH_EMPLOYEE = 'PH_EMPLOYEE',
  TEMP_EMPLOYEE = 'TEMP_EMPLOYEE',
}

export const PERSONNEL_TYPE_LABELS: Record<PersonnelType, string> = {
  [PersonnelType.CIVIL_SERVANT]: 'ข้าราชการ',
  [PersonnelType.GOV_EMPLOYEE]: 'พนักงานราชการ',
  [PersonnelType.PH_EMPLOYEE]: 'พนักงานกระทรวงสาธารณสุข (พกส.)',
  [PersonnelType.TEMP_EMPLOYEE]: 'ลูกจ้างชั่วคราว',
};

/**
 * Request types
 */
export enum RequestType {
  NEW_ENTRY = 'NEW_ENTRY',
  EDIT_INFO_SAME_RATE = 'EDIT_INFO_SAME_RATE',
  EDIT_INFO_NEW_RATE = 'EDIT_INFO_NEW_RATE',
}

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  [RequestType.NEW_ENTRY]: 'ขอรับค่าตอบแทนใหม่',
  [RequestType.EDIT_INFO_SAME_RATE]: 'แก้ไขข้อมูล (อัตราเดิม)',
  [RequestType.EDIT_INFO_NEW_RATE]: 'แก้ไขข้อมูล (อัตราใหม่)',
};

/**
 * Request status
 */
export enum RequestStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  [RequestStatus.DRAFT]: 'แบบร่าง',
  [RequestStatus.PENDING]: 'รอพิจารณา',
  [RequestStatus.APPROVED]: 'อนุมัติแล้ว',
  [RequestStatus.REJECTED]: 'ถูกปฏิเสธ',
  [RequestStatus.CANCELLED]: 'ยกเลิก',
  [RequestStatus.RETURNED]: 'ส่งคืนแก้ไข',
};

/**
 * Action types
 */
export enum ActionType {
  SUBMIT = 'SUBMIT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  RETURN = 'RETURN',
}

/**
 * File attachment types
 */
export enum FileType {
  LICENSE = 'LICENSE',
  DIPLOMA = 'DIPLOMA',
  ORDER_DOC = 'ORDER_DOC',
  OTHER = 'OTHER',
}

/**
 * Step mappings
 */
export const STEP_ROLE_MAP: Record<number, string> = {
  1: 'HEAD_DEPT',
  2: 'PTS_OFFICER',
  3: 'HEAD_HR',
  4: 'DIRECTOR',
  5: 'HEAD_FINANCE',
};

export const ROLE_STEP_MAP: Record<string, number> = {
  HEAD_DEPT: 1,
  PTS_OFFICER: 2,
  HEAD_HR: 3,
  DIRECTOR: 4,
  HEAD_FINANCE: 5,
};

/**
 * Work attributes (checkboxes)
 */
export interface WorkAttributes {
  operation: boolean;
  planning: boolean;
  coordination: boolean;
  service: boolean;
}

export const WORK_ATTRIBUTE_LABELS = {
  operation: 'ปฏิบัติการ',
  planning: 'วางแผน',
  coordination: 'ประสานงาน',
  service: 'บริการ',
};

/**
 * Base request
 */
export interface PTSRequest {
  request_no?: string;
  request_id: number;
  user_id: number;

  personnel_type: PersonnelType;
  position_number: string | null;
  department_group: string | null;
  main_duty: string | null;
  work_attributes: WorkAttributes | null;
  applicant_signature: string | null;

  request_type: RequestType;
  requested_amount: number | null;
  effective_date: string | null;

  status: RequestStatus;
  current_step: number;
  submission_data: any;

  created_at: Date | string;
  updated_at: Date | string;
  submitted_at: Date | string | null;
}

export interface RequestAction {
  action_id: number;
  request_id: number;
  actor_id: number;
  action_type: ActionType;
  from_step?: number;
  to_step?: number;
  comment: string | null;
  created_at: Date | string;
  action?: ActionType | string;
  action_date?: Date | string;
}

export interface RequestAttachment {
  attachment_id: number;
  request_id: number;
  file_type: FileType;
  file_name?: string;
  original_filename?: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: Date | string;
}

export interface RequesterInfo {
  citizen_id: string;
  role: string;
  first_name?: string;
  last_name?: string;
  position?: string;
}

export interface RequestWithDetails extends PTSRequest {
  attachments?: RequestAttachment[];
  actions?: RequestActionWithActor[];
  requester?: RequesterInfo;
}

export interface RequestActionWithActor extends RequestAction {
  actor?: {
    citizen_id: string;
    role: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface CreateRequestDTO {
  personnel_type: PersonnelType;
  position_number: string;
  department_group?: string;
  main_duty?: string;
  work_attributes: WorkAttributes;

  request_type: RequestType;
  requested_amount?: number;
  effective_date?: string;
}

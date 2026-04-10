import type { DisplayScope } from "../utils";

export interface PrefillProfile {
  citizen_id?: string;
  title?: string;
  first_name?: string;
  last_name?: string;
  position_name?: string;
  position_number?: string;
  department?: string;
  sub_department?: string;
  mission_group?: string;
  employee_type?: string;
  first_entry_date?: string;
}

export interface PersonnelOption {
  user_id: number;
  citizen_id: string;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  position_number?: string | null;
  department?: string | null;
  sub_department?: string | null;
  emp_type?: string | null;
}

export interface EligibilityRecord {
  eligibility_id: number;
  user_id: number | null;
  citizen_id?: string | null;
  master_rate_id: number;
  request_id: number | null;
  effective_date: string;
  expiry_date?: string | null;
  is_active?: boolean | number | null;
  created_at?: string | null;
  request_no?: string | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  position_number?: string | null;
  department?: string | null;
  sub_department?: string | null;
  emp_type?: string | null;
  original_status?: string | null;
  email?: string | null;
  phone?: string | null;
  active_eligibility_count?: number | null;
  upcoming_change_type?: "RETIREMENT" | "RESIGN" | "TRANSFER_OUT" | null;
  upcoming_change_effective_date?: string | null;
  latest_license_status?: string | null;
  latest_license_valid_from?: string | null;
  latest_license_valid_until?: string | null;
  profession_code?: string | null;
  group_no?: number | null;
  item_no?: string | number | null;
  sub_item_no?: string | number | null;
  rate_amount?: number | null;
  attachments?: Array<{
    attachment_id: number;
    request_id: number;
    file_type?: string | null;
    file_path: string;
    file_name: string;
    uploaded_at?: string | null;
  }>;
  eligibility_attachments?: Array<{
    attachment_id: number;
    eligibility_id: number;
    file_type?: string | null;
    file_path: string;
    file_name: string;
    uploaded_by?: number | null;
    uploaded_at?: string | null;
  }>;
  eligibility_ocr_precheck?: {
    eligibility_id: number;
    status: "queued" | "processing" | "completed" | "failed" | "skipped";
    source?: string | null;
    worker?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    count?: number | null;
    success_count?: number | null;
    failed_count?: number | null;
    error?: string | null;
    results?: Array<{
      name?: string;
      ok?: boolean;
      markdown?: string;
      error?: string;
      document_kind?: string;
      fields?: Record<string, unknown>;
      missing_fields?: string[];
      quality?: {
        required_fields?: number;
        captured_fields?: number;
        passed?: boolean;
      };
    }> | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
  license?: {
    license_id: number;
    citizen_id: string;
    license_name?: string | null;
    license_no?: string | null;
    valid_from: string;
    valid_until: string;
    status?: string | null;
    synced_at?: string | null;
  } | null;
}

export interface EligibilitySummaryRow {
  profession_code: string;
  people_count: number;
  total_rate_amount: number;
  people_with_alerts: number;
  critical_people: number;
  no_license_people: number;
  duplicate_people: number;
  upcoming_change_people: number;
}

export interface EligibilityAlertSummary {
  people_with_alerts: number;
  critical_people: number;
  no_license_people: number;
  duplicate_people: number;
  upcoming_change_people: number;
}

export interface EligibilitySummary {
  updated_at: string | null;
  total_people: number;
  total_rate_amount: number;
  alert_summary: EligibilityAlertSummary;
  by_profession: EligibilitySummaryRow[];
}

export interface EligibilityPagedMeta {
  page: number;
  limit: number;
  total: number;
  updated_at: string | null;
  total_rate_amount: number;
  has_sub_item_no?: boolean;
}

export interface EligibilityPagedResult {
  items: EligibilityRecord[];
  meta: EligibilityPagedMeta;
}

export interface EligibilityManageResult {
  eligibility_id: number;
  is_active: boolean;
  deactivated_count?: number;
}

export interface ScopeMember {
  citizenId: string;
  fullName: string;
  position: string;
  department: string | null;
  subDepartment: string | null;
  userRole: string | null;
  userRoleLabel: string;
}

export interface ScopeWithMembers extends DisplayScope {
  memberCount: number;
  members: ScopeMember[];
}

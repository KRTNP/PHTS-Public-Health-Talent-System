/**
 * license-compliance module - API client
 *
 */
import api from "@/shared/api/axios";
import { ApiPayload, ApiParams, ApiResponse } from "@/shared/api/types";

export interface LicenseComplianceSummary {
  expired: number;
  expiring_30: number;
  expiring_60: number;
  expiring_90: number;
  total: number;
}

export async function getLicenseComplianceSummary(): Promise<LicenseComplianceSummary> {
  const res = await api.get<ApiResponse<LicenseComplianceSummary>>(
    "/license-compliance/summary",
  );
  return res.data.data;
}

export async function getLicenseComplianceList(params?: ApiParams) {
  const res = await api.get<ApiResponse<LicenseComplianceListItem[]>>(
    "/license-compliance/list",
    { params },
  );
  return res.data.data;
}

export interface LicenseComplianceListItem {
  citizen_id: string;
  full_name: string;
  position_name: string;
  department?: string | null;
  profession_code?: string | null;
  license_no?: string | null;
  license_expiry: string | null;
  days_left: number | null;
  bucket: "expired" | "30" | "60" | "90";
  last_notified_at?: string | null;
}

export async function notifyLicenseCompliance(
  items: Array<{ citizen_id: string; bucket: "expired" | "30" | "60" | "90" }>,
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    "/license-compliance/notify",
    { items },
  );
  return res.data.data;
}

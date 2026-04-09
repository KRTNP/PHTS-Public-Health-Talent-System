import api from "@/shared/api/axios";
import { ApiResponse } from "@/shared/api/types";
import type {
  EligibilityManageResult,
  EligibilityPagedResult,
  EligibilityRecord,
  EligibilitySummary,
} from "./request-api.types";

export async function uploadEligibilityAttachments(
  eligibilityId: number | string,
  formData: FormData,
): Promise<NonNullable<EligibilityRecord["attachments"]>> {
  const res = await api.post<ApiResponse<NonNullable<EligibilityRecord["attachments"]>>>(
    "/requests/eligibility/" + eligibilityId + "/attachments",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return res.data.data;
}

export async function deleteEligibilityAttachment(
  eligibilityId: number | string,
  attachmentId: number | string,
): Promise<{ deleted: boolean; attachment_id: number }> {
  const res = await api.delete<ApiResponse<{ deleted: boolean; attachment_id: number }>>(
    "/requests/eligibility/" + eligibilityId + "/attachments/" + attachmentId,
  );
  return res.data.data;
}

export async function getEligibilityList(
  activeOnly = true,
): Promise<EligibilityRecord[]> {
  const res = await api.get<ApiResponse<EligibilityRecord[]>>(
    "/requests/eligibility",
    {
      params: { active_only: activeOnly ? "1" : "0" },
    },
  );
  return res.data.data;
}

export async function getEligibilitySummary(
  paramsOrActiveOnly:
    | boolean
    | {
        active_only?: "0" | "1" | "2";
        profession_code?: string;
        search?: string;
        rate_group?: string;
        department?: string;
        sub_department?: string;
        license_status?: "all" | "active" | "expiring" | "expired";
        alert_filter?: "all" | "any" | "error" | "no-license" | "duplicate" | "upcoming-change";
      } = true,
): Promise<EligibilitySummary> {
  const params =
    typeof paramsOrActiveOnly === "boolean"
      ? { active_only: paramsOrActiveOnly ? "1" : "0" }
      : { active_only: "1", ...paramsOrActiveOnly };
  const res = await api.get<ApiResponse<EligibilitySummary>>(
    "/requests/eligibility/summary",
    {
      params,
    },
  );
  return res.data.data;
}

export async function getEligibilityPaged(params: {
  active_only?: "0" | "1" | "2";
  page?: number;
  limit?: number;
  profession_code?: string;
  search?: string;
  rate_group?: string;
  department?: string;
  sub_department?: string;
  license_status?: "all" | "active" | "expiring" | "expired";
  alert_filter?: "all" | "any" | "error" | "no-license" | "duplicate" | "upcoming-change";
}): Promise<EligibilityPagedResult> {
  const res = await api.get<ApiResponse<EligibilityPagedResult>>(
    "/requests/eligibility",
    {
      params,
    },
  );
  return res.data.data;
}

export async function getEligibilityById(
  id: number | string,
): Promise<EligibilityRecord> {
  const res = await api.get<ApiResponse<EligibilityRecord>>(
    "/requests/eligibility/" + id,
  );
  return res.data.data;
}

export async function setPrimaryEligibility(
  eligibilityId: number | string,
  payload?: { reason?: string },
): Promise<EligibilityManageResult> {
  const res = await api.post<ApiResponse<EligibilityManageResult>>(
    "/requests/eligibility/" + eligibilityId + "/set-primary",
    payload ?? {},
  );
  return res.data.data;
}

export async function deactivateEligibility(
  eligibilityId: number | string,
  payload?: { reason?: string },
): Promise<EligibilityManageResult> {
  const res = await api.post<ApiResponse<EligibilityManageResult>>(
    "/requests/eligibility/" + eligibilityId + "/deactivate",
    payload ?? {},
  );
  return res.data.data;
}

export async function reactivateEligibility(
  eligibilityId: number | string,
  payload?: { reason?: string },
): Promise<EligibilityManageResult> {
  const res = await api.post<ApiResponse<EligibilityManageResult>>(
    "/requests/eligibility/" + eligibilityId + "/reactivate",
    payload ?? {},
  );
  return res.data.data;
}

export async function exportEligibilityCsv(params: {
  active_only?: "0" | "1" | "2";
  profession_code?: string;
  search?: string;
  rate_group?: string;
  department?: string;
  sub_department?: string;
  license_status?: "all" | "active" | "expiring" | "expired";
  alert_filter?: "all" | "any" | "error" | "no-license" | "duplicate" | "upcoming-change";
}): Promise<Blob> {
  const res = await api.get("/requests/eligibility/export", {
    params,
    responseType: "blob",
  });
  return res.data as Blob;
}

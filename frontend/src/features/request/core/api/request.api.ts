import api from "@/shared/api/axios";
import { ApiPayload, ApiResponse } from "@/shared/api/types";
import { RequestWithDetails } from "@/types/request.types";
import type {
  MasterRate,
  PersonnelOption,
  PrefillProfile,
  ScopeWithMembers,
} from "./request-api.types";
import type { DisplayScope } from "../utils";

export async function getMyRequests(): Promise<RequestWithDetails[]> {
  const res = await api.get<ApiResponse<RequestWithDetails[]>>("/requests");
  return res.data.data;
}

export async function getRequestById(
  id: number | string,
): Promise<RequestWithDetails> {
  const res = await api.get<ApiResponse<RequestWithDetails>>(`/requests/${id}`);
  return res.data.data;
}

export async function createRequest(
  formData: FormData,
): Promise<RequestWithDetails> {
  const res = await api.post<ApiResponse<RequestWithDetails>>(
    "/requests",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return res.data.data;
}

export async function updateRequest(
  id: number | string,
  formData: FormData,
): Promise<RequestWithDetails> {
  const res = await api.put<ApiResponse<RequestWithDetails>>(
    `/requests/${id}`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return res.data.data;
}

export async function submitRequest(
  id: number | string,
  confirmed = true,
): Promise<void> {
  await api.post(`/requests/${id}/submit`, { confirmed });
}

export async function cancelRequest(id: number | string): Promise<void> {
  await api.post(`/requests/${id}/cancel`);
}

export async function getMasterRates() {
  const res = await api.get<ApiResponse<MasterRate[]>>(
    "/requests/master-rates",
  );
  return res.data.data;
}

export async function getPrefill(targetUserId?: number | string) {
  const res = await api.get<ApiResponse<PrefillProfile>>("/requests/prefill", {
    params: targetUserId ? { target_user_id: targetUserId } : undefined,
  });
  return res.data.data;
}

export async function searchPersonnelOptions(
  search: string,
  limit = 20,
): Promise<PersonnelOption[]> {
  const res = await api.get<ApiResponse<PersonnelOption[]>>(
    "/requests/personnel-options",
    {
      params: { search, limit },
    },
  );
  return res.data.data;
}

export async function getMyScopes(): Promise<DisplayScope[]> {
  const res = await api.get<ApiResponse<DisplayScope[]>>("/requests/my-scopes");
  return res.data.data;
}

export async function getMyScopeMembers(): Promise<ScopeWithMembers[]> {
  const res = await api.get<ApiResponse<ScopeWithMembers[]>>(
    "/requests/my-scopes/members",
  );
  return res.data.data;
}

export async function confirmAttachments(id: number | string) {
  const res = await api.post<ApiResponse<{ message: string }>>(
    `/requests/${id}/attachments/confirm`,
  );
  return res.data.data;
}

export async function deleteRequestAttachment(
  id: number | string,
  attachmentId: number | string,
) {
  const res = await api.delete<ApiResponse<RequestWithDetails>>(
    `/requests/${id}/attachments/${attachmentId}`,
  );
  return res.data.data;
}

export async function updateRateMapping(
  id: number | string,
  payload: {
    group_no: number;
    item_no: string | null;
    sub_item_no?: string | null;
  },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/requests/${id}/rate-mapping`,
    payload,
  );
  return res.data.data;
}

export async function updateVerificationChecks(
  id: number | string,
  payload: { qualification_ok: boolean; evidence_ok: boolean },
) {
  const res = await api.put<ApiResponse<ApiPayload>>(
    `/requests/${id}/verification`,
    payload,
  );
  return res.data.data;
}

export async function createVerificationSnapshot(
  id: number | string,
  payload: {
    master_rate_id: number;
    effective_date: string;
    expiry_date?: string;
    snapshot_data: Record<string, unknown>;
  },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/requests/${id}/verification-snapshot`,
    payload,
  );
  return res.data.data;
}

import api from "@/shared/api/axios";
import { ApiPayload, ApiResponse } from "@/shared/api/types";
import type { OfficerOption, ReassignHistoryItem } from "./request-api.types";

export async function getAvailableOfficers() {
  const res = await api.get<ApiResponse<OfficerOption[]>>(
    "/requests/pts-officers",
  );
  return res.data.data;
}

export async function reassignRequest(
  id: number | string,
  payload: { target_officer_id: number; remark?: string },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    "/requests/" + id + "/reassign",
    payload,
  );
  return res.data.data;
}

export async function getReassignHistory(id: number | string) {
  const res = await api.get<ApiResponse<ReassignHistoryItem[]>>(
    "/requests/" + id + "/reassign-history",
  );
  return res.data.data;
}

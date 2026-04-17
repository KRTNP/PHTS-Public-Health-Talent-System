import api from "@/shared/api/axios";
import { ApiPayload, ApiResponse } from "@/shared/api/types";
import { RequestWithDetails } from "@/types/request.types";

export async function getPendingApprovals(scope?: string) {
  const res = await api.get<ApiResponse<RequestWithDetails[]>>(
    "/requests/pending",
    {
      params: scope ? { scope } : undefined,
    },
  );
  return res.data.data;
}

export async function getApprovalHistory(params?: {
  view?: "mine" | "team";
  actions?: "important" | "all";
}): Promise<RequestWithDetails[]> {
  const res = await api.get<ApiResponse<RequestWithDetails[]>>(
    "/requests/history",
    {
      params,
    },
  );
  return res.data.data;
}

// Canonical action endpoint
export async function processAction(
  id: number | string,
  payload: {
    action: "APPROVE" | "REJECT" | "RETURN";
    comment?: string;
    signature_base64?: string;
  },
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    "/requests/" + id + "/action",
    payload,
  );
  return res.data.data;
}

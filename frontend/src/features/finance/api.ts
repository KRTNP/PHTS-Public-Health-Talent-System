/**
 * finance module - API client
 *
 */
import api from "@/shared/api/axios";
import { ApiPayload, ApiParams, ApiResponse } from "@/shared/api/types";

export async function getFinanceDashboard() {
  const res = await api.get<ApiResponse<ApiPayload>>("/finance/dashboard");
  return res.data.data;
}

export async function getFinanceSummary(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>("/finance/summary", {
    params,
  });
  return res.data.data;
}

export async function getFinanceYearlySummary(params?: ApiParams) {
  const res = await api.get<ApiResponse<ApiPayload>>("/finance/yearly", {
    params,
  });
  return res.data.data;
}

export async function getPayoutsByPeriod(
  periodId: number | string,
  params?: ApiParams,
) {
  const res = await api.get<ApiResponse<ApiPayload>>(
    `/finance/periods/${periodId}/payouts`,
    { params },
  );
  return res.data.data;
}

export async function markPayoutAsPaid(
  payoutId: number | string,
  payload: ApiPayload,
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/finance/payouts/${payoutId}/mark-paid`,
    payload,
  );
  return res.data.data;
}

export async function batchMarkAsPaid(payload: ApiPayload) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    "/finance/payouts/batch-mark-paid",
    payload,
  );
  return res.data.data;
}

export async function cancelPayout(
  payoutId: number | string,
  payload?: ApiPayload,
) {
  const res = await api.post<ApiResponse<ApiPayload>>(
    `/finance/payouts/${payoutId}/cancel`,
    payload ?? {},
  );
  return res.data.data;
}

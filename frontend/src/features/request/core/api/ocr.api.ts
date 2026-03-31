import api from "@/shared/api/axios";
import { ApiResponse } from "@/shared/api/types";

export async function persistManualOcrPrecheck(
  id: number | string,
  payload: {
    worker?: string;
    count?: number;
    success_count?: number;
    failed_count?: number;
    error?: string | null;
    results?: Array<{
      name?: string;
      ok?: boolean;
      markdown?: string;
      error?: string;
    }>;
  },
) {
  const res = await api.post<ApiResponse<{ saved: true }>>(
    "/requests/" + id + "/ocr-precheck/manual",
    payload,
  );
  return res.data.data;
}

export async function runRequestAttachmentsOcr(
  requestId: number | string,
  payload: {
    attachments: Array<{
      attachment_id: number;
    }>;
  },
) {
  const res = await api.post<
    ApiResponse<{
      saved: true;
      count: number;
      success_count: number;
      failed_count: number;
      results: Array<{
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
      }>;
    }>
  >("/requests/" + requestId + "/attachments/ocr", payload);
  return res.data.data;
}

export async function clearRequestAttachmentOcr(
  requestId: number | string,
  payload: {
    file_name: string;
  },
) {
  const res = await api.post<
    ApiResponse<{
      saved: true;
      count: number;
      success_count: number;
      failed_count: number;
    }>
  >("/requests/" + requestId + "/ocr-precheck/clear", payload);
  return res.data.data;
}

export async function persistEligibilityManualOcrPrecheck(
  id: number | string,
  payload: {
    worker?: string;
    count?: number;
    success_count?: number;
    failed_count?: number;
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
    }>;
  },
) {
  const res = await api.post<ApiResponse<{ saved: true }>>(
    "/requests/eligibility/" + id + "/ocr-precheck/manual",
    payload,
  );
  return res.data.data;
}

export async function runEligibilityAttachmentsOcr(
  eligibilityId: number | string,
  payload: {
    attachments: Array<{
      attachment_id: number;
      source: "eligibility" | "request";
    }>;
  },
) {
  const res = await api.post<
    ApiResponse<{
      saved: true;
      count: number;
      success_count: number;
      failed_count: number;
      results: Array<{
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
      }>;
    }>
  >("/requests/eligibility/" + eligibilityId + "/attachments/ocr", payload);
  return res.data.data;
}

export async function clearEligibilityAttachmentOcr(
  eligibilityId: number | string,
  payload: {
    file_name: string;
  },
) {
  const res = await api.post<
    ApiResponse<{
      saved: true;
      count: number;
      success_count: number;
      failed_count: number;
    }>
  >("/requests/eligibility/" + eligibilityId + "/ocr-precheck/clear", payload);
  return res.data.data;
}

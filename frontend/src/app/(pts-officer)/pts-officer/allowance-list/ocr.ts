export type AllowanceOcrBatchSummary = {
  total: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    name?: string;
    ok?: boolean;
    markdown?: string;
    error?: string;
    engine_used?: string;
    fallback_used?: boolean;
    document_kind?: string;
    fields?: Record<string, unknown>;
    missing_fields?: string[];
    fallback_reason?: string;
    quality?: {
      required_fields?: number;
      captured_fields?: number;
      passed?: boolean;
    };
  }>;
};

export const ALLOWANCE_OCR_SERVICE_BASE = (
  process.env.NEXT_PUBLIC_OCR_API_URL || ""
).replace(/\/+$/, "");

export async function runAllowanceAttachmentOcr(
  files: File[],
  serviceBase: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AllowanceOcrBatchSummary> {
  const trimmedBase = serviceBase.trim().replace(/\/+$/, "");
  if (!trimmedBase) {
    throw new Error("ยังไม่ได้ตั้งค่า OCR URL");
  }
  if (files.length === 0) {
    return { total: 0, successCount: 0, failedCount: 0, results: [] };
  }

  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetchImpl(`${trimmedBase}/ocr-batch`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "OCR service error");
  }

  const payload = (await response.json()) as {
    count?: number;
    results?: Array<{
      name?: string;
      ok?: boolean;
      markdown?: string;
      error?: string;
      engine_used?: string;
      fallback_used?: boolean;
      document_kind?: string;
      fields?: Record<string, unknown>;
      missing_fields?: string[];
      fallback_reason?: string;
      quality?: {
        required_fields?: number;
        captured_fields?: number;
        passed?: boolean;
      };
    }>;
  };
  const results = payload.results ?? [];
  const successCount = results.filter((item) => item.ok).length;
  const total = Number(payload.count ?? results.length ?? files.length);
  const failedCount = Math.max(0, total - successCount);

  return {
    total,
    successCount,
    failedCount,
    results,
  };
}

export async function runAllowanceSingleAttachmentOcr(
  params: {
    fileUrl: string;
    fileName: string;
    serviceBase: string;
    token?: string | null;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<AllowanceOcrBatchSummary> {
  const attachmentResponse = await fetchImpl(params.fileUrl, {
    headers: params.token
      ? { Authorization: `Bearer ${params.token}` }
      : undefined,
  });
  if (!attachmentResponse.ok) {
    throw new Error("ไม่สามารถดึงไฟล์แนบเพื่อส่ง OCR ได้");
  }

  const blob = await attachmentResponse.blob();
  const file = new File([blob], params.fileName, {
    type: blob.type || "application/octet-stream",
  });

  return runAllowanceAttachmentOcr([file], params.serviceBase, fetchImpl);
}

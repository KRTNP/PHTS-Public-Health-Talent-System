import { readFile } from "node:fs/promises";
import path from "node:path";
import { runLocalTesseract } from "@/modules/ocr/services/ocr-local-tesseract.service.js";
import type { OcrBatchResultItem } from "@/modules/ocr/entities/ocr-precheck.entity.js";

export type StoredOcrFileInput = {
  file_name: string;
  file_path: string;
};

export type OcrBatchRunSummary = {
  count: number;
  success_count: number;
  failed_count: number;
  results: OcrBatchResultItem[];
};

export const resolveStoredOcrFilePath = (filePath: string): string => {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
};

export const runStoredFileOcrBatch = async (
  files: StoredOcrFileInput[],
): Promise<OcrBatchRunSummary> => {
  const results: OcrBatchResultItem[] = [];

  for (const file of files) {
    try {
      const bytes = await readFile(resolveStoredOcrFilePath(file.file_path));
      const result = await runLocalTesseract(file.file_name, bytes);
      results.push(result);
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Unknown OCR error";
      const isUnavailable = rawMessage === "OCR_MAIN_SERVICE_UNAVAILABLE";

      results.push({
        name: file.file_name,
        ok: false,
        error: isUnavailable ? "ยังไม่ได้เปิดบริการ OCR หลัก" : rawMessage,
      });
    }
  }

  const success_count = results.filter((item) => item.ok).length;
  const failed_count = results.length - success_count;

  return {
    count: results.length,
    success_count,
    failed_count,
    results,
  };
};

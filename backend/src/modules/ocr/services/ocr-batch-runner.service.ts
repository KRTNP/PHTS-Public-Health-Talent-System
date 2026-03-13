import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OcrHttpProvider } from '@/modules/ocr/providers/ocr-http.provider.js';
import type { OcrBatchResultItem } from '@/modules/ocr/entities/ocr-precheck.entity.js';

export type StoredOcrFileInput = {
  file_name: string;
  file_path: string;
};

export type OcrBatchRunSummary = {
  service_url: string;
  count: number;
  success_count: number;
  failed_count: number;
  results: OcrBatchResultItem[];
};

export const resolveStoredOcrFilePath = (filePath: string): string => {
  if (path.isAbsolute(filePath)) return filePath;
  return path.resolve(process.cwd(), filePath);
};

export const mergeOcrResultsByFileName = (
  existing: OcrBatchResultItem[],
  incoming: OcrBatchResultItem[],
): OcrBatchResultItem[] => {
  const toArabicDigits = (value: string): string =>
    value.replace(/[๐-๙]/g, (char) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(char)));

  const getStructuredAssignmentScore = (markdown?: string): number => {
    const text = String(markdown ?? '');
    if (!text) return 0;

    const normalized = toArabicDigits(text);
    let score = 0;

    if (/(?:คำสั่ง|คําสั่ง).*(?:มอบหมาย|รับผิดชอบ|ปฏิบัติงาน)/.test(normalized)) {
      score += 1;
    }
    if (/(?:ที่|ที)\s*[0-9]{1,4}\s*\/\s*[0-9]{1,5}/.test(normalized)) {
      score += 1;
    }
    if (/(?:สั่ง\s*ณ\s*วันที่|สง\s*ณ\s*วันที่).*(?:25[0-9]{2})/.test(normalized)) {
      score += 1;
    }
    if (/(?:ตั้งแต่วันที่|ต้งแต่วันที่).*(?:25[0-9]{2})/.test(normalized)) {
      score += 1;
    }
    return score;
  };

  const hasSuspiciousThaiYear = (markdown?: string): boolean =>
    /(พ\.ศ\.\s*(?:25[0-3]\d|๒๕[๐-๓][๐-๙]))/.test(String(markdown ?? ''));

  const hasSuspiciousOrderNo = (markdown?: string): boolean => {
    const normalized = toArabicDigits(String(markdown ?? ''));
    return /(?:ที่|ที)\s*[0-9]{1,4}\s*\/\s*[0-9]{5,}/.test(normalized);
  };

  const shouldReplaceExisting = (
    current: OcrBatchResultItem,
    candidate: OcrBatchResultItem,
  ): boolean => {
    if (current.ok !== true) return candidate.ok === true;
    if (candidate.ok !== true) return false;

    const currentPassed = current.quality?.passed === true;
    const candidatePassed = candidate.quality?.passed === true;
    if (candidatePassed && !currentPassed) return true;
    if (!candidatePassed && currentPassed) return false;

    const currentSuspiciousYear = hasSuspiciousThaiYear(current.markdown);
    const candidateSuspiciousYear = hasSuspiciousThaiYear(candidate.markdown);
    if (currentSuspiciousYear && !candidateSuspiciousYear) return true;
    if (!currentSuspiciousYear && candidateSuspiciousYear) return false;

    const currentSuspiciousOrderNo = hasSuspiciousOrderNo(current.markdown);
    const candidateSuspiciousOrderNo = hasSuspiciousOrderNo(candidate.markdown);
    if (currentSuspiciousOrderNo && !candidateSuspiciousOrderNo) return true;
    if (!currentSuspiciousOrderNo && candidateSuspiciousOrderNo) return false;

    const currentStructuredScore = getStructuredAssignmentScore(current.markdown);
    const candidateStructuredScore = getStructuredAssignmentScore(candidate.markdown);
    if (candidateStructuredScore > currentStructuredScore) return true;
    if (candidateStructuredScore < currentStructuredScore) return false;

    const currentLength = String(current.markdown ?? '')
      .replace(/\s+/g, ' ')
      .trim().length;
    const candidateLength = String(candidate.markdown ?? '')
      .replace(/\s+/g, ' ')
      .trim().length;
    return candidateLength >= Math.floor(currentLength * 1.1);
  };

  const merged = new Map<string, OcrBatchResultItem>();
  for (const item of existing) {
    const key = String(item.name ?? '').trim().toLowerCase();
    if (!key) continue;
    merged.set(key, item);
  }
  for (const item of incoming) {
    const key = String(item.name ?? '').trim().toLowerCase();
    if (!key) continue;
    const current = merged.get(key);
    if (!current || shouldReplaceExisting(current, item)) {
      merged.set(key, item);
    }
  }
  return Array.from(merged.values());
};

export const runStoredFileOcrBatch = async (
  files: StoredOcrFileInput[],
  ocrBase = OcrHttpProvider.getServiceBase(),
  options?: {
    disableFallbackChain?: boolean;
  },
): Promise<OcrBatchRunSummary> => {
  const results: OcrBatchResultItem[] = [];
  for (const file of files) {
    const bytes = await readFile(resolveStoredOcrFilePath(file.file_path));
    const result = await OcrHttpProvider.processSingleFile(
      file.file_name,
      bytes,
      ocrBase,
      options,
    );
    results.push(result);
  }

  const success_count = results.filter((item) => item.ok).length;
  const failed_count = results.length - success_count;

  return {
    service_url: ocrBase,
    count: results.length,
    success_count,
    failed_count,
    results,
  };
};

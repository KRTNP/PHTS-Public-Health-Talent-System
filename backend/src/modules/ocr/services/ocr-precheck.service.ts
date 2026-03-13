import { FileType } from '@/modules/request/contracts/request.types.js';
import {
  OCR_QUEUE_KEY,
  type OcrBatchResultItem,
  type OcrQueueJob,
} from '@/modules/ocr/entities/ocr-precheck.entity.js';
import { OcrHttpProvider } from '@/modules/ocr/providers/ocr-http.provider.js';
import {
  mergeOcrResultsByFileName,
  runStoredFileOcrBatch,
} from '@/modules/ocr/services/ocr-batch-runner.service.js';
import { saveOcrPrecheck } from '@/modules/ocr/services/ocr-precheck-store.service.js';
import { OcrRequestRepository } from '@/modules/ocr/repositories/ocr-request.repository.js';
import redis from '@config/redis.js';

const isFastFirstEnabled = (): boolean => process.env.OCR_FAST_FIRST !== 'false';

const toArabicDigits = (value: string): string =>
  value.replace(/[๐-๙]/g, (char) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(char)));

const isAssignmentOrderCandidate = (item: OcrBatchResultItem): boolean => {
  const kind = String(item.document_kind ?? '').trim().toLowerCase();
  if (kind === 'assignment_order') return true;
  const normalized = toArabicDigits(String(item.markdown ?? ''));
  return (
    /(?:คำสั่ง|คําสั่ง).*(?:มอบหมาย|รับผิดชอบ|ปฏิบัติงาน)/.test(normalized) ||
    /(?:ที่|ที)\s*[0-9]{1,4}\s*\/\s*[0-9]{1,5}/.test(normalized)
  );
};

const hasSuspiciousOrderNo = (markdown?: string): boolean => {
  const normalized = toArabicDigits(String(markdown ?? ''));
  return /(?:ที่|ที)\s*[0-9]{1,4}\s*\/\s*[0-9]{5,}/.test(normalized);
};

const hasSuspiciousAssignmentDates = (markdown?: string): boolean => {
  const normalized = toArabicDigits(String(markdown ?? ''));
  const signedYear = normalized.match(/(?:สั่ง\s*ณ\s*วันที่|สง\s*ณ\s*วันที่)[\s\S]{0,80}(25[0-9]{2})/);
  const effectiveYear = normalized.match(/(?:ตั้งแต่วันที่|ต้งแต่วันที่)[\s\S]{0,80}(25[0-9]{2})/);
  const signed = signedYear?.[1] ? Number(signedYear[1]) : null;
  const effective = effectiveYear?.[1] ? Number(effectiveYear[1]) : null;
  if (signed && signed < 2550) return true;
  if (effective && effective < 2550) return true;
  if (signed && effective && Math.abs(signed - effective) >= 3) return true;
  return false;
};

const shouldEnhanceWithPaddle = (item: OcrBatchResultItem): boolean =>
  isAssignmentOrderCandidate(item) &&
  item.ok === true &&
  item.suppressed !== true &&
  (item.quality?.passed === false ||
    ((item.engine_used ?? '').toLowerCase().includes('tesseract') &&
      (/(พ\.ศ\.\s*(?:25[0-3]\d|๒๕[๐-๓][๐-๙]))/.test(String(item.markdown ?? '')) ||
        hasSuspiciousOrderNo(item.markdown) ||
        hasSuspiciousAssignmentDates(item.markdown))));

export const processRequestOcrPrecheck = async (requestId: number): Promise<void> => {
  const ocrBase = OcrHttpProvider.getServiceBase();
  if (!ocrBase) {
    await saveOcrPrecheck({ kind: 'request', id: requestId }, {
      status: 'skipped',
      error: 'OCR service URL is not configured',
      finished_at: new Date().toISOString(),
    });
    return;
  }

  await saveOcrPrecheck({ kind: 'request', id: requestId }, {
    status: 'processing',
    started_at: new Date().toISOString(),
    service_url: ocrBase,
    worker: 'redis-list',
  });

  try {
    const attachments = await OcrRequestRepository.findAttachments(requestId);
    const candidates = attachments.filter(
      (attachment) => attachment.file_type !== FileType.SIGNATURE && Boolean(attachment.file_path),
    );

    if (!candidates.length) {
      await saveOcrPrecheck({ kind: 'request', id: requestId }, {
        status: 'failed',
        error: 'No attachments to OCR',
        finished_at: new Date().toISOString(),
        results: [],
      });
      return;
    }

    const files = candidates.map((attachment) => ({
        file_name: attachment.file_name,
        file_path: attachment.file_path,
      }));
    const fastFirstEnabled = isFastFirstEnabled();

    const summary = await runStoredFileOcrBatch(
      files,
      ocrBase,
      fastFirstEnabled
        ? {
            disableFallbackChain: true,
          }
        : undefined,
    );

    await saveOcrPrecheck({ kind: 'request', id: requestId }, {
      status: summary.success_count > 0 ? 'completed' : 'failed',
      finished_at: new Date().toISOString(),
      service_url: summary.service_url,
      count: summary.count,
      success_count: summary.success_count,
      failed_count: summary.failed_count,
      results: summary.results,
    });

    if (!fastFirstEnabled) {
      return;
    }

    const paddleBase = OcrHttpProvider.getPaddleServiceBase();
    if (!paddleBase || paddleBase === ocrBase) {
      return;
    }

    const filePathByName = new Map<string, string>();
    for (const file of files) {
      const key = String(file.file_name ?? '').trim().toLowerCase();
      if (!key) continue;
      filePathByName.set(key, file.file_path);
    }

    const filesToEnhance = summary.results
      .filter(shouldEnhanceWithPaddle)
      .map((item) => {
        const fileName = String(item.name ?? '').trim();
        const filePath = filePathByName.get(fileName.toLowerCase());
        if (!fileName || !filePath) return null;
        return {
          file_name: fileName,
          file_path: filePath,
        };
      })
      .filter((item): item is { file_name: string; file_path: string } => Boolean(item));

    if (filesToEnhance.length === 0) {
      return;
    }

    try {
      const enhanced = await runStoredFileOcrBatch(filesToEnhance, paddleBase, {
        disableFallbackChain: true,
      });
      const mergedResults = mergeOcrResultsByFileName(summary.results, enhanced.results);
      const successCount = mergedResults.filter((item) => item.ok).length;
      const failedCount = mergedResults.length - successCount;

      await saveOcrPrecheck({ kind: 'request', id: requestId }, {
        status: successCount > 0 ? 'completed' : 'failed',
        finished_at: new Date().toISOString(),
        service_url: summary.service_url,
        count: mergedResults.length,
        success_count: successCount,
        failed_count: failedCount,
        results: mergedResults,
      });
    } catch (error) {
      console.error('[OCRQueue] paddle enhancement failed:', error);
    }
  } catch (error) {
    await saveOcrPrecheck({ kind: 'request', id: requestId }, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'OCR processing failed',
      finished_at: new Date().toISOString(),
    });
  }
};

export const enqueueRequestOcrPrecheck = async (requestId: number): Promise<void> => {
  const payload: OcrQueueJob = {
    requestId,
    enqueuedAt: new Date().toISOString(),
  };
  await redis.lpush(OCR_QUEUE_KEY, JSON.stringify(payload));
};

import { FileType } from "@/modules/request/contracts/request.types.js";
import {
  OCR_QUEUE_KEY,
  type OcrQueueJob,
} from "@/modules/ocr/entities/ocr-precheck.entity.js";
import { runStoredFileOcrBatch } from "@/modules/ocr/services/ocr-batch-runner.service.js";
import { saveOcrPrecheck } from "@/modules/ocr/services/ocr-precheck-store.service.js";
import { OcrRequestRepository } from "@/modules/ocr/repositories/ocr-request.repository.js";
import redis from "@config/redis.js";

export const processRequestOcrPrecheck = async (
  requestId: number,
): Promise<void> => {
  await saveOcrPrecheck(
    { kind: "request", id: requestId },
    {
      status: "processing",
      started_at: new Date().toISOString(),
      worker: "redis-list",
    },
  );

  try {
    const attachments = await OcrRequestRepository.findAttachments(requestId);
    const candidates = attachments.filter(
      (attachment) =>
        attachment.file_type !== FileType.SIGNATURE &&
        Boolean(attachment.file_path),
    );

    if (!candidates.length) {
      await saveOcrPrecheck(
        { kind: "request", id: requestId },
        {
          status: "failed",
          error: "No attachments to OCR",
          finished_at: new Date().toISOString(),
          results: [],
        },
      );
      return;
    }

    const files = candidates.map((attachment) => ({
      file_name: attachment.file_name,
      file_path: attachment.file_path,
    }));
    const summary = await runStoredFileOcrBatch(files);

    await saveOcrPrecheck(
      { kind: "request", id: requestId },
      {
        status: summary.success_count > 0 ? "completed" : "failed",
        finished_at: new Date().toISOString(),
        count: summary.count,
        success_count: summary.success_count,
        failed_count: summary.failed_count,
        results: summary.results,
      },
    );
  } catch (error) {
    await saveOcrPrecheck(
      { kind: "request", id: requestId },
      {
        status: "failed",
        error: error instanceof Error ? error.message : "OCR processing failed",
        finished_at: new Date().toISOString(),
      },
    );
  }
};

export const enqueueRequestOcrPrecheck = async (
  requestId: number,
): Promise<void> => {
  const payload: OcrQueueJob = {
    requestId,
    enqueuedAt: new Date().toISOString(),
  };
  await redis.lpush(OCR_QUEUE_KEY, JSON.stringify(payload));
};

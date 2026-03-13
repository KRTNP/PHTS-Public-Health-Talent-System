import redis from '@config/redis.js';
import {
  OCR_QUEUE_KEY,
  OCR_WORKER_BRPOP_TIMEOUT_SEC,
  type OcrQueueJob,
} from '@/modules/ocr/entities/ocr-precheck.entity.js';
import {
  enqueueRequestOcrPrecheck,
  processRequestOcrPrecheck,
} from '@/modules/ocr/services/ocr-precheck.service.js';
import { OcrRequestRepository } from '@/modules/ocr/repositories/ocr-request.repository.js';

let workerRunning = false;
let workerPromise: Promise<void> | null = null;
let workerRedisClient: typeof redis | null = null;

const DEFAULT_STALE_PROCESSING_MINUTES = 30;

const isWorkerEnabled = (): boolean => process.env.OCR_WORKER_ENABLED !== 'false';
const getStaleProcessingMinutes = (): number => {
  const raw = Number(process.env.OCR_STALE_PROCESSING_MINUTES || DEFAULT_STALE_PROCESSING_MINUTES);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_STALE_PROCESSING_MINUTES;
  return Math.floor(raw);
};

export const recoverStaleOcrPrecheckJobs = async (): Promise<number> => {
  const staleMinutes = getStaleProcessingMinutes();
  const staleRequestIds = await OcrRequestRepository.findStaleProcessingRequestIds(staleMinutes);
  if (staleRequestIds.length === 0) return 0;

  const nowIso = new Date().toISOString();
  for (const requestId of staleRequestIds) {
    await OcrRequestRepository.upsertRequestPrecheck(requestId, {
      status: 'queued',
      queued_at: nowIso,
      started_at: null,
      finished_at: null,
      count: 0,
      success_count: 0,
      failed_count: 0,
      error: `Recovered stale OCR processing job after ${staleMinutes} minutes`,
      results: [],
    });
    await enqueueRequestOcrPrecheck(requestId);
  }

  console.log(`[OCRQueue] recovered ${staleRequestIds.length} stale job(s)`);
  return staleRequestIds.length;
};

const workerLoop = async (): Promise<void> => {
  if (!workerRedisClient) return;

  try {
    await recoverStaleOcrPrecheckJobs();
  } catch (error) {
    console.error('[OCRQueue] stale recovery error:', error);
  }

  while (workerRunning) {
    try {
      const item = await workerRedisClient.brpop(
        OCR_QUEUE_KEY,
        OCR_WORKER_BRPOP_TIMEOUT_SEC,
      );
      if (!item) continue;

      const [, rawPayload] = item;
      const job = JSON.parse(rawPayload) as OcrQueueJob;
      if (!job?.requestId || !Number.isFinite(job.requestId)) continue;

      await processRequestOcrPrecheck(Number(job.requestId));
    } catch (error) {
      console.error('[OCRQueue] worker error:', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

export const startOcrPrecheckWorker = (): void => {
  if (!isWorkerEnabled()) {
    console.log('[OCRQueue] worker disabled by OCR_WORKER_ENABLED=false');
    return;
  }
  if (workerRunning) return;
  workerRedisClient = redis.duplicate();
  workerRunning = true;
  workerPromise = workerLoop();
  console.log('[OCRQueue] worker started');
};

export const stopOcrPrecheckWorker = async (): Promise<void> => {
  workerRunning = false;
  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }
  if (workerRedisClient) {
    await workerRedisClient.quit().catch(() => workerRedisClient?.disconnect());
    workerRedisClient = null;
  }
  console.log('[OCRQueue] worker stopped');
};

export const getOcrWorkerEnabled = (): boolean => isWorkerEnabled();

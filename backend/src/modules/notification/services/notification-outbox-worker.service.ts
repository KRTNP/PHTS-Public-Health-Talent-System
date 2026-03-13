import { NotificationOutboxService } from '@/modules/notification/services/notification-outbox.service.js';

const DEFAULT_POLL_MS = 5000;
const DEFAULT_BATCH_LIMIT = 100;

let workerRunning = false;
let workerPromise: Promise<void> | null = null;
let wakeWorker: (() => void) | null = null;

const toSafeInt = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

const getPollMs = (): number =>
  toSafeInt(process.env.NOTIFICATION_OUTBOX_WORKER_POLL_MS, DEFAULT_POLL_MS, 250, 60000);

const getBatchLimit = (): number =>
  toSafeInt(process.env.NOTIFICATION_OUTBOX_WORKER_BATCH_LIMIT, DEFAULT_BATCH_LIMIT, 1, 200);

const waitForNextTick = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (wakeWorker === wake) wakeWorker = null;
      resolve();
    }, ms);
    const wake = () => {
      clearTimeout(timer);
      if (wakeWorker === wake) wakeWorker = null;
      resolve();
    };
    wakeWorker = wake;
  });

const workerLoop = async (): Promise<void> => {
  const pollMs = getPollMs();
  const batchLimit = getBatchLimit();
  while (workerRunning) {
    try {
      const result = await NotificationOutboxService.processBatch(batchLimit);
      if (result.processed > 0 || result.requeued > 0) {
        console.log(
          `[NotificationQueue] processed=${result.processed} sent=${result.sent} failed=${result.failed} requeued=${result.requeued}`,
        );
      }
    } catch (error) {
      console.error('[NotificationQueue] worker error:', error);
    }

    if (!workerRunning) break;
    await waitForNextTick(pollMs);
  }
};

export const startNotificationOutboxWorker = (): void => {
  if (process.env.NOTIFICATION_OUTBOX_WORKER_ENABLED === 'false') {
    console.log('[NotificationQueue] worker disabled by NOTIFICATION_OUTBOX_WORKER_ENABLED=false');
    return;
  }
  if (workerRunning) return;
  workerRunning = true;
  workerPromise = workerLoop();
  console.log('[NotificationQueue] worker started');
};

export const stopNotificationOutboxWorker = async (): Promise<void> => {
  workerRunning = false;
  if (wakeWorker) wakeWorker();
  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }
  console.log('[NotificationQueue] worker stopped');
};


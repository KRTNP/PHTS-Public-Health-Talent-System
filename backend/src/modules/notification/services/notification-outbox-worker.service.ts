import { NotificationOutboxService } from "@/modules/notification/services/notification-outbox.service.js";
import { getNotificationOutboxWorkerConfig } from "@config/runtime-config.js";

let workerRunning = false;
let workerPromise: Promise<void> | null = null;
let wakeWorker: (() => void) | null = null;

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
  const { pollMs, batchLimit } = getNotificationOutboxWorkerConfig();
  while (workerRunning) {
    try {
      const result = await NotificationOutboxService.processBatch(batchLimit);
      if (result.processed > 0 || result.requeued > 0) {
        console.log(
          `[NotificationQueue] processed=${result.processed} sent=${result.sent} failed=${result.failed} requeued=${result.requeued}`,
        );
      }
    } catch (error) {
      console.error("[NotificationQueue] worker error:", error);
    }

    if (!workerRunning) break;
    await waitForNextTick(pollMs);
  }
};

export const startNotificationOutboxWorker = (): void => {
  if (!getNotificationOutboxWorkerConfig().enabled) {
    console.log(
      "[NotificationQueue] worker disabled by NOTIFICATION_OUTBOX_WORKER_ENABLED=false",
    );
    return;
  }
  if (workerRunning) return;
  workerRunning = true;
  workerPromise = workerLoop();
  console.log("[NotificationQueue] worker started");
};

export const stopNotificationOutboxWorker = async (): Promise<void> => {
  workerRunning = false;
  if (wakeWorker) wakeWorker();
  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }
  console.log("[NotificationQueue] worker stopped");
};

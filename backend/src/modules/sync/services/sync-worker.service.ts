import { SyncService } from "@/modules/sync/services/sync.service.js";
import { getSyncWorkerConfig } from "@config/runtime-config.js";

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
  const pollMs = getSyncWorkerConfig().pollMs;
  while (workerRunning) {
    try {
      const startedAt = Date.now();
      const result = await SyncService.performScheduledFullSync({
        triggeredBy: null,
      });
      if (result) {
        console.log(
          `[SyncWorker] auto sync done duration_ms=${Date.now() - startedAt} batch_id=${result.batch_id}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("already in progress")) {
        console.warn(
          "[SyncWorker] auto sync skipped: sync already in progress",
        );
      } else {
        console.error("[SyncWorker] auto sync failed:", message);
      }
    }

    if (!workerRunning) break;
    await waitForNextTick(pollMs);
  }
};

export const startSyncWorker = (): void => {
  if (!getSyncWorkerConfig().enabled) {
    console.log("[SyncWorker] disabled by SYNC_WORKER_ENABLED=false");
    return;
  }
  if (workerRunning) return;
  workerRunning = true;
  workerPromise = workerLoop();
  console.log("[SyncWorker] started");
};

export const stopSyncWorker = async (): Promise<void> => {
  workerRunning = false;
  if (wakeWorker) wakeWorker();
  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }
  console.log("[SyncWorker] stopped");
};

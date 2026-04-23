import { processSnapshotOutboxBatch } from "@/modules/snapshot/services/snapshot.service.js";
import { getSnapshotWorkerConfig } from "@config/runtime-config.js";

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
  const { pollMs, batchLimit } = getSnapshotWorkerConfig();
  while (workerRunning) {
    try {
      const result = await processSnapshotOutboxBatch(batchLimit);
      if (result.processed > 0) {
        console.log(
          `[SnapshotQueue] processed=${result.processed} sent=${result.sent} failed=${result.failed} requeued=${result.requeued}`,
        );
      } else if (result.requeued > 0) {
        console.log(`[SnapshotQueue] requeued=${result.requeued}`);
      }
    } catch (error) {
      console.error("[SnapshotQueue] worker error:", error);
    }

    if (!workerRunning) break;
    await waitForNextTick(pollMs);
  }
};

export const startSnapshotWorker = (): void => {
  if (!getSnapshotWorkerConfig().enabled) {
    console.log(
      "[SnapshotQueue] worker disabled by SNAPSHOT_WORKER_ENABLED=false",
    );
    return;
  }
  if (workerRunning) return;
  workerRunning = true;
  workerPromise = workerLoop();
  console.log("[SnapshotQueue] worker started");
};

export const stopSnapshotWorker = async (): Promise<void> => {
  workerRunning = false;
  if (wakeWorker) wakeWorker();
  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }
  console.log("[SnapshotQueue] worker stopped");
};

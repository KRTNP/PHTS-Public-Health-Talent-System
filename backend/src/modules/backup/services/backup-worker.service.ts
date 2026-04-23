import {
  runBackupJob,
  shouldRunScheduledBackup,
} from "@/modules/backup/services/backup.service.js";
import { getBackupWorkerConfig } from "@config/runtime-config.js";

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
  const pollMs = getBackupWorkerConfig().pollMs;
  while (workerRunning) {
    try {
      const shouldRun = await shouldRunScheduledBackup();
      if (shouldRun) {
        const result = await runBackupJob({ triggerSource: 'SCHEDULED' });
        console.log('[BackupWorker] scheduled backup:', result);
      }
    } catch (error) {
      console.error('[BackupWorker] worker error:', error);
    }

    if (!workerRunning) break;
    await waitForNextTick(pollMs);
  }
};

export const startBackupWorker = (): void => {
  if (!getBackupWorkerConfig().enabled) {
    console.log("[BackupWorker] disabled by BACKUP_WORKER_ENABLED=false");
    return;
  }
  if (workerRunning) return;
  workerRunning = true;
  workerPromise = workerLoop();
  console.log('[BackupWorker] started');
};

export const stopBackupWorker = async (): Promise<void> => {
  workerRunning = false;
  if (wakeWorker) wakeWorker();
  if (workerPromise) {
    await workerPromise;
    workerPromise = null;
  }
  console.log('[BackupWorker] stopped');
};


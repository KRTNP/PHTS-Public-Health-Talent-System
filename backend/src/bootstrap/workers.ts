import {
  startOcrPrecheckWorker,
  stopOcrPrecheckWorker,
} from "@/modules/ocr/services/ocr-worker.service.js";
import {
  startSnapshotWorker,
  stopSnapshotWorker,
} from "@/modules/snapshot/services/snapshot-worker.service.js";
import {
  startSyncWorker,
  stopSyncWorker,
} from "@/modules/sync/services/sync-worker.service.js";
import {
  startBackupWorker,
  stopBackupWorker,
} from "@/modules/backup/services/backup-worker.service.js";
import {
  startNotificationOutboxWorker,
  stopNotificationOutboxWorker,
} from "@/modules/notification/services/notification-outbox-worker.service.js";

export const startBackgroundWorkers = (): void => {
  startOcrPrecheckWorker();
  startSnapshotWorker();
  startSyncWorker();
  startBackupWorker();
  startNotificationOutboxWorker();
};

export const stopBackgroundWorkers = async (): Promise<void> => {
  await stopOcrPrecheckWorker();
  await stopSnapshotWorker();
  await stopSyncWorker();
  await stopBackupWorker();
  await stopNotificationOutboxWorker();
};


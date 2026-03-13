import { startBackupWorker, stopBackupWorker } from '@/modules/backup/services/backup-worker.service.js';
import { runWorkerRuntime } from '@/scripts/ops/runners/worker-runtime.js';

runWorkerRuntime({
  name: 'BackupWorkerRunner',
  start: () => startBackupWorker(),
  stop: () => stopBackupWorker(),
});


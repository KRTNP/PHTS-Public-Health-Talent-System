import { startSyncWorker, stopSyncWorker } from '@/modules/sync/services/sync-worker.service.js';
import { runWorkerRuntime } from '@/scripts/ops/runners/worker-runtime.js';

runWorkerRuntime({
  name: 'SyncWorkerRunner',
  start: () => startSyncWorker(),
  stop: () => stopSyncWorker(),
});


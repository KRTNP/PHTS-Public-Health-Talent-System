import {
  startSnapshotWorker,
  stopSnapshotWorker,
} from '@/modules/snapshot/services/snapshot-worker.service.js';
import { runWorkerRuntime } from '@/scripts/ops/runners/worker-runtime.js';

runWorkerRuntime({
  name: 'SnapshotWorkerRunner',
  start: () => startSnapshotWorker(),
  stop: () => stopSnapshotWorker(),
});


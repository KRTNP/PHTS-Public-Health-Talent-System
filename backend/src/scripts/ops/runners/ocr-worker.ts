import {
  startOcrPrecheckWorker,
  stopOcrPrecheckWorker,
} from '@/modules/ocr/services/ocr-worker.service.js';
import { runWorkerRuntime } from '@/scripts/ops/runners/worker-runtime.js';

runWorkerRuntime({
  name: 'OCRWorkerRunner',
  start: () => startOcrPrecheckWorker(),
  stop: () => stopOcrPrecheckWorker(),
});

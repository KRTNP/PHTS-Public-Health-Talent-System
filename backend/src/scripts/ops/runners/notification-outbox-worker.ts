import {
  startNotificationOutboxWorker,
  stopNotificationOutboxWorker,
} from '@/modules/notification/services/notification-outbox-worker.service.js';
import { runWorkerRuntime } from '@/scripts/ops/runners/worker-runtime.js';

runWorkerRuntime({
  name: 'NotificationOutboxWorkerRunner',
  start: () => startNotificationOutboxWorker(),
  stop: () => stopNotificationOutboxWorker(),
});


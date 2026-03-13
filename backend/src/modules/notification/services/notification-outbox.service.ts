import { NotificationRepository } from '@/modules/notification/repositories/notification.repository.js';
import { NotificationOutboxRepository } from '@/modules/notification/repositories/notification-outbox.repository.js';
import type { NotificationOutboxPayload } from '@/modules/notification/entities/notification-outbox.entity.js';
import type { PoolConnection } from "mysql2/promise";
import { NotificationType, normalizeNotificationType } from '@/modules/notification/entities/notification.entity.js';

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_RETRY_BASE_SECONDS = 30;
const DEFAULT_RETRY_MAX_SECONDS = 1800;
const DEFAULT_PROCESSING_TIMEOUT_SECONDS = 300;

const toSafeInt = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

const getMaxAttempts = (): number =>
  toSafeInt(process.env.NOTIFICATION_OUTBOX_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS, 1, 100);

const getRetryBaseSeconds = (): number =>
  toSafeInt(process.env.NOTIFICATION_OUTBOX_RETRY_BASE_SECONDS, DEFAULT_RETRY_BASE_SECONDS, 1, 3600);

const getRetryMaxSeconds = (): number => {
  const maxSeconds = toSafeInt(
    process.env.NOTIFICATION_OUTBOX_RETRY_MAX_SECONDS,
    DEFAULT_RETRY_MAX_SECONDS,
    1,
    7 * 24 * 3600,
  );
  const baseSeconds = getRetryBaseSeconds();
  return Math.max(baseSeconds, maxSeconds);
};

const getProcessingTimeoutSeconds = (): number =>
  toSafeInt(
    process.env.NOTIFICATION_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
    DEFAULT_PROCESSING_TIMEOUT_SECONDS,
    30,
    24 * 3600,
  );

export class NotificationOutboxService {
  static async enqueue(
    payload: NotificationOutboxPayload,
    conn?: PoolConnection,
  ): Promise<number> {
    return NotificationOutboxRepository.enqueue(payload, conn);
  }

  static async processBatch(limit = 100): Promise<{
    processed: number;
    sent: number;
    failed: number;
    requeued: number;
  }> {
    const maxAttempts = getMaxAttempts();
    const retryBaseSeconds = getRetryBaseSeconds();
    const retryMaxSeconds = getRetryMaxSeconds();
    const processingTimeoutSeconds = getProcessingTimeoutSeconds();
    const conn = await NotificationOutboxRepository.getConnection();
    let processed = 0;
    let sent = 0;
    let failed = 0;
    let requeued = 0;

    try {
      await conn.beginTransaction();

      requeued = await NotificationOutboxRepository.reclaimStuckProcessing(
        processingTimeoutSeconds,
        maxAttempts,
        retryBaseSeconds,
        retryMaxSeconds,
        conn,
      );
      const rows = await NotificationOutboxRepository.fetchPending(
        limit,
        maxAttempts,
        conn,
      );
      for (const row of rows) {
        processed += 1;
        try {
          await this.processRow(row, conn);
          await NotificationOutboxRepository.markSent(row.outbox_id, conn);
          sent += 1;
        } catch (err: any) {
          const msg = err?.message ?? String(err);
          await NotificationOutboxRepository.markFailed(
            row.outbox_id,
            msg,
            maxAttempts,
            retryBaseSeconds,
            retryMaxSeconds,
            conn,
          );
          failed += 1;
        }
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    return { processed, sent, failed, requeued };
  }

  private static async processRow(
    row: Awaited<ReturnType<typeof NotificationOutboxRepository.fetchPending>>[number],
    conn: PoolConnection,
  ): Promise<void> {
    await NotificationOutboxRepository.markProcessing(row.outbox_id, conn);
    const payload = row.payload;
    const title = payload.title;
    const message = payload.message;
    const link = payload.link ?? "#";
    const type = normalizeNotificationType(payload.type, NotificationType.SYSTEM);

    if (payload.kind === "USER") {
      await this.createForUser(payload.userId, title, message, link, type, conn);
      return;
    }
    if (payload.kind === "ROLE") {
      await this.createForRole(payload.role, title, message, link, type, conn);
      return;
    }
    throw new Error(`Unknown notification kind: ${payload.kind}`);
  }

  private static async createForUser(
    userId: number | undefined,
    title: string,
    message: string,
    link: string,
    type: NotificationType,
    conn: PoolConnection,
  ): Promise<void> {
    if (!userId) {
      throw new Error("Missing userId for USER notification");
    }
    const inAppEnabled = await NotificationRepository.isInAppEnabled(userId, conn);
    if (!inAppEnabled) return;
    await NotificationRepository.create(userId, title, message, link, type, conn);
  }

  private static async createForRole(
    role: string | undefined,
    title: string,
    message: string,
    link: string,
    type: NotificationType,
    conn: PoolConnection,
  ): Promise<void> {
    if (!role) {
      throw new Error("Missing role for ROLE notification");
    }
    const userIds = await NotificationRepository.findUserIdsByRoleForInApp(role, conn);
    if (userIds.length === 0) {
      return;
    }
    const notifications = userIds.map((userId) => ({
      userId,
      title,
      message,
      link,
      type,
    }));
    await NotificationRepository.createBulk(notifications, conn);
  }
}

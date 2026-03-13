import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import db from '@config/database.js';
import type {
  NotificationOutboxPayload,
  NotificationOutboxRecord,
  NotificationOutboxStatus,
} from '@/modules/notification/entities/notification-outbox.entity.js';

export class NotificationOutboxRepository {
  private static parsePayload(raw: unknown): NotificationOutboxPayload {
    if (typeof raw === 'string') {
      return JSON.parse(raw) as NotificationOutboxPayload;
    }
    if (raw && typeof raw === 'object') {
      return raw as NotificationOutboxPayload;
    }
    throw new Error('Invalid outbox payload');
  }

  static async enqueue(
    payload: NotificationOutboxPayload,
    conn?: PoolConnection,
  ): Promise<number> {
    const executor = conn ?? db;
    const [result] = await executor.execute<ResultSetHeader>(
      `INSERT INTO ntf_outbox (payload, status, attempts, available_at)
       VALUES (?, 'PENDING', 0, NOW())`,
      [JSON.stringify(payload)],
    );
    return result.insertId;
  }

  static async fetchPending(
    limit: number,
    maxAttempts: number,
    conn: PoolConnection,
  ): Promise<NotificationOutboxRecord[]> {
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const safeMaxAttempts = Math.max(1, Math.floor(maxAttempts));
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT outbox_id, payload, status, attempts, last_error, available_at, created_at, processed_at
       FROM ntf_outbox
       WHERE status IN ('PENDING', 'FAILED')
         AND attempts < ${safeMaxAttempts}
         AND available_at <= NOW()
       ORDER BY status ASC, available_at ASC, outbox_id ASC
       LIMIT ${safeLimit}
       FOR UPDATE SKIP LOCKED`,
    );
    return rows.map((row: any) => ({
      outbox_id: row.outbox_id,
      payload: this.parsePayload(row.payload),
      status: row.status as NotificationOutboxStatus,
      attempts: Number(row.attempts || 0),
      last_error: row.last_error ?? null,
      available_at: row.available_at,
      created_at: row.created_at,
      processed_at: row.processed_at ?? null,
    }));
  }

  static async markProcessing(
    outboxId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `UPDATE ntf_outbox
       SET status = 'PROCESSING', available_at = NOW()
       WHERE outbox_id = ?`,
      [outboxId],
    );
  }

  static async markSent(
    outboxId: number,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute(
      `UPDATE ntf_outbox
       SET status = 'SENT', processed_at = NOW()
       WHERE outbox_id = ?`,
      [outboxId],
    );
  }

  static async markFailed(
    outboxId: number,
    errorMessage: string,
    maxAttempts: number,
    retryBaseSeconds: number,
    retryMaxSeconds: number,
    conn: PoolConnection,
  ): Promise<void> {
    const safeMaxAttempts = Math.max(1, Math.floor(maxAttempts));
    const safeRetryBaseSeconds = Math.max(1, Math.floor(retryBaseSeconds));
    const safeRetryMaxSeconds = Math.max(safeRetryBaseSeconds, Math.floor(retryMaxSeconds));
    await conn.execute(
      `UPDATE ntf_outbox
       SET status = 'FAILED',
           attempts = attempts + 1,
           last_error = ?,
           available_at = CASE
             WHEN attempts + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL 3650 DAY)
             ELSE DATE_ADD(
               NOW(),
               INTERVAL LEAST(?, POW(2, GREATEST(attempts, 0)) * ?) SECOND
             )
           END
       WHERE outbox_id = ?`,
      [
        errorMessage.slice(0, 2000),
        safeMaxAttempts,
        safeRetryMaxSeconds,
        safeRetryBaseSeconds,
        outboxId,
      ],
    );
  }

  static async reclaimStuckProcessing(
    processingTimeoutSeconds: number,
    maxAttempts: number,
    retryBaseSeconds: number,
    retryMaxSeconds: number,
    conn: PoolConnection,
  ): Promise<number> {
    const safeTimeoutSeconds = Math.max(10, Math.floor(processingTimeoutSeconds));
    const safeMaxAttempts = Math.max(1, Math.floor(maxAttempts));
    const safeRetryBaseSeconds = Math.max(1, Math.floor(retryBaseSeconds));
    const safeRetryMaxSeconds = Math.max(safeRetryBaseSeconds, Math.floor(retryMaxSeconds));
    const [result] = await conn.execute<ResultSetHeader>(
      `UPDATE ntf_outbox
       SET status = 'FAILED',
           attempts = attempts + 1,
           last_error = CONCAT('PROCESSING_TIMEOUT_', ?, 's'),
           available_at = CASE
             WHEN attempts + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL 3650 DAY)
             ELSE DATE_ADD(
               NOW(),
               INTERVAL LEAST(?, POW(2, GREATEST(attempts, 0)) * ?) SECOND
             )
           END
       WHERE status = 'PROCESSING'
         AND attempts < ?
         AND available_at <= DATE_SUB(NOW(), INTERVAL ? SECOND)`,
      [
        safeTimeoutSeconds,
        safeMaxAttempts,
        safeRetryMaxSeconds,
        safeRetryBaseSeconds,
        safeMaxAttempts,
        safeTimeoutSeconds,
      ],
    );
    return Number(result.affectedRows ?? 0);
  }

  static async getConnection(): Promise<PoolConnection> {
    return db.getConnection();
  }

  static async findOutboxRows(params: {
    page: number;
    limit: number;
    status?: "PENDING" | "PROCESSING" | "FAILED" | "SENT" | "DEAD_LETTER";
    maxAttempts: number;
  }): Promise<{ rows: NotificationOutboxRecord[]; total: number; page: number; limit: number }> {
    const safePage = Math.max(1, Math.floor(params.page || 1));
    const safeLimit = Math.max(1, Math.min(Math.floor(params.limit || 10), 100));
    const safeOffset = (safePage - 1) * safeLimit;
    const safeMaxAttempts = Math.max(1, Math.floor(params.maxAttempts));

    let whereSql = "";
    const whereValues: Array<string | number> = [];
    if (params.status) {
      if (params.status === "DEAD_LETTER") {
        whereSql = "WHERE status = 'FAILED' AND attempts >= ?";
        whereValues.push(safeMaxAttempts);
      } else {
        whereSql = "WHERE status = ?";
        whereValues.push(params.status);
      }
    }

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count
       FROM ntf_outbox
       ${whereSql}`,
      whereValues,
    );
    const total = Number((countRows[0] as any)?.count ?? 0);

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT outbox_id, payload, status, attempts, last_error, available_at, created_at, processed_at
       FROM ntf_outbox
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ${safeLimit}
       OFFSET ${safeOffset}`,
      whereValues,
    );

    return {
      rows: rows.map((row: any) => ({
        outbox_id: row.outbox_id,
        payload: this.parsePayload(row.payload),
        status: row.status as NotificationOutboxStatus,
        attempts: Number(row.attempts || 0),
        last_error: row.last_error ?? null,
        available_at: row.available_at,
        created_at: row.created_at,
        processed_at: row.processed_at ?? null,
      })),
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  static async retryOutboxRow(outboxId: number): Promise<boolean> {
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE ntf_outbox
       SET status = 'PENDING',
           attempts = 0,
           available_at = NOW(),
           processed_at = NULL,
           last_error = NULL
       WHERE outbox_id = ?
         AND status = 'FAILED'`,
      [outboxId],
    );
    return Number(result.affectedRows ?? 0) > 0;
  }

  static async retryDeadLetterRows(maxAttempts: number): Promise<number> {
    const safeMaxAttempts = Math.max(1, Math.floor(maxAttempts));
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE ntf_outbox
       SET status = 'PENDING',
           attempts = 0,
           available_at = NOW(),
           processed_at = NULL,
           last_error = NULL
       WHERE status = 'FAILED'
         AND attempts >= ?`,
      [safeMaxAttempts],
    );
    return Number(result.affectedRows ?? 0);
  }
}

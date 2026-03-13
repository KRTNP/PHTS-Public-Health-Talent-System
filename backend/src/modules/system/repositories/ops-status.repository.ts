import { RowDataPacket } from 'mysql2/promise';
import db from '@config/database.js';

export class OpsStatusRepository {
  static async countNotificationOutboxByStatus(): Promise<
    Array<{ status: string; count: number }>
  > {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count
       FROM ntf_outbox
       GROUP BY status`,
    );
    return (rows as Array<{ status: string; count: number }>).map((row) => ({
      status: String(row.status),
      count: Number(row.count ?? 0),
    }));
  }

  static async findLatestNotificationOutbox(limit = 20): Promise<
    Array<{
      outbox_id: number;
      status: string;
      attempts: number;
      last_error: string | null;
      available_at: Date;
      created_at: Date;
      processed_at: Date | null;
    }>
  > {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT outbox_id, status, attempts, last_error, available_at, created_at, processed_at
       FROM ntf_outbox
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`,
    );
    return rows as Array<{
      outbox_id: number;
      status: string;
      attempts: number;
      last_error: string | null;
      available_at: Date;
      created_at: Date;
      processed_at: Date | null;
    }>;
  }

  static async countOpenPayrollPeriods(): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM pay_periods WHERE status <> 'CLOSED'",
    );
    return Number((rows[0] as { count?: number } | undefined)?.count ?? 0);
  }

  static async findLatestOpenPayrollPeriods(limit = 5): Promise<
    Array<{
      period_id: number;
      period_year: number;
      period_month: number;
      status: string;
      snapshot_status: string;
      updated_at: Date;
    }>
  > {
    const safeLimit = Math.max(1, Math.min(limit, 50));
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT period_id, period_year, period_month, status, snapshot_status, updated_at
       FROM pay_periods
       WHERE status <> 'CLOSED'
       ORDER BY period_year DESC, period_month DESC
       LIMIT ${safeLimit}`,
    );
    return rows as Array<{
      period_id: number;
      period_year: number;
      period_month: number;
      status: string;
      snapshot_status: string;
      updated_at: Date;
    }>;
  }

  static async findOldestNotificationBacklogAt(maxAttempts: number): Promise<Date | null> {
    const safeMaxAttempts = Math.max(1, Math.floor(maxAttempts));
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT MIN(created_at) AS oldest_created_at
       FROM ntf_outbox
       WHERE status IN ('PENDING', 'PROCESSING')
          OR (status = 'FAILED' AND attempts < ?)`,
      [safeMaxAttempts],
    );
    const raw = (rows[0] as { oldest_created_at?: Date | string | null } | undefined)
      ?.oldest_created_at;
    if (!raw) return null;
    const date = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  static async countNotificationOutboxByStatusSince(
    since: Date,
  ): Promise<Array<{ status: string; count: number }>> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count
       FROM ntf_outbox
       WHERE created_at >= ?
       GROUP BY status`,
      [since],
    );
    return (rows as Array<{ status: string; count: number }>).map((row) => ({
      status: String(row.status),
      count: Number(row.count ?? 0),
    }));
  }

  static async countNotificationOutboxDeadLetters(maxAttempts: number): Promise<number> {
    const safeMaxAttempts = Math.max(1, Math.floor(maxAttempts));
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM ntf_outbox
       WHERE status = 'FAILED'
         AND attempts >= ?`,
      [safeMaxAttempts],
    );
    return Number((rows[0] as { count?: number } | undefined)?.count ?? 0);
  }

  static async countSnapshotOutboxByStatus(): Promise<
    Array<{ status: string; count: number }>
  > {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count
       FROM pay_snapshot_outbox
       GROUP BY status`,
    );
    return (rows as Array<{ status: string; count: number }>).map((row) => ({
      status: String(row.status),
      count: Number(row.count ?? 0),
    }));
  }

  static async findLatestSnapshotOutbox(limit = 20): Promise<
    Array<{
      outbox_id: number;
      period_id: number;
      requested_by: number | null;
      status: string;
      attempts: number;
      last_error: string | null;
      available_at: Date;
      created_at: Date;
      processed_at: Date | null;
    }>
  > {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT outbox_id, period_id, requested_by, status, attempts, last_error, available_at, created_at, processed_at
       FROM pay_snapshot_outbox
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`,
    );
    return rows as Array<{
      outbox_id: number;
      period_id: number;
      requested_by: number | null;
      status: string;
      attempts: number;
      last_error: string | null;
      available_at: Date;
      created_at: Date;
      processed_at: Date | null;
    }>;
  }

  static async findOldestSnapshotBacklogAt(maxAttempts: number): Promise<Date | null> {
    const safeMaxAttempts = Math.max(1, Math.floor(maxAttempts));
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT MIN(created_at) AS oldest_created_at
       FROM pay_snapshot_outbox
       WHERE status IN ('PENDING', 'PROCESSING')
          OR (status = 'FAILED' AND attempts < ?)`,
      [safeMaxAttempts],
    );
    const raw = (rows[0] as { oldest_created_at?: Date | string | null } | undefined)
      ?.oldest_created_at;
    if (!raw) return null;
    const date = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  static async countSnapshotOutboxByStatusSince(
    since: Date,
  ): Promise<Array<{ status: string; count: number }>> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT status, COUNT(*) as count
       FROM pay_snapshot_outbox
       WHERE created_at >= ?
       GROUP BY status`,
      [since],
    );
    return (rows as Array<{ status: string; count: number }>).map((row) => ({
      status: String(row.status),
      count: Number(row.count ?? 0),
    }));
  }

  static async countSnapshotOutboxDeadLetters(maxAttempts: number): Promise<number> {
    const safeMaxAttempts = Math.max(1, Math.floor(maxAttempts));
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count
       FROM pay_snapshot_outbox
       WHERE status = 'FAILED'
         AND attempts >= ?`,
      [safeMaxAttempts],
    );
    return Number((rows[0] as { count?: number } | undefined)?.count ?? 0);
  }
}

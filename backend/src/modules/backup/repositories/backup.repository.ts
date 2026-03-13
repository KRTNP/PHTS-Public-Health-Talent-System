import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import db from '@config/database.js';

export class BackupRepository {
  static async createBackupJob(
    triggerSource: 'MANUAL' | 'SCHEDULED',
    triggeredBy: number | null,
  ): Promise<number> {
    const [result] = await db.execute<ResultSetHeader>(
      `
      INSERT INTO sys_backup_jobs (trigger_source, triggered_by, status, started_at)
      VALUES (?, ?, 'RUNNING', NOW())
      `,
      [triggerSource, triggeredBy],
    );
    return Number(result.insertId);
  }

  static async finishBackupJob(
    jobId: number,
    payload: {
      status: 'SUCCESS' | 'FAILED';
      backupFilePath?: string | null;
      backupFileSizeBytes?: number | null;
      durationMs?: number | null;
      stdoutText?: string | null;
      stderrText?: string | null;
      errorMessage?: string | null;
    },
  ): Promise<void> {
    await db.execute(
      `
      UPDATE sys_backup_jobs
      SET status = ?,
          backup_file_path = ?,
          backup_file_size_bytes = ?,
          duration_ms = ?,
          stdout_text = ?,
          stderr_text = ?,
          error_message = ?,
          finished_at = NOW()
      WHERE job_id = ?
      `,
      [
        payload.status,
        payload.backupFilePath ?? null,
        payload.backupFileSizeBytes ?? null,
        payload.durationMs ?? null,
        payload.stdoutText ?? null,
        payload.stderrText ?? null,
        payload.errorMessage ?? null,
        jobId,
      ],
    );
  }

  static async getBackupHistory(limit = 20): Promise<
    Array<{
      job_id: number;
      trigger_source: string;
      triggered_by: number | null;
      status: string;
      backup_file_path: string | null;
      backup_file_size_bytes: number | null;
      duration_ms: number | null;
      error_message: string | null;
      started_at: Date;
      finished_at: Date | null;
      created_at: Date;
    }>
  > {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT job_id,
             trigger_source,
             triggered_by,
             status,
             backup_file_path,
             backup_file_size_bytes,
             duration_ms,
             error_message,
             started_at,
             finished_at,
             created_at
      FROM sys_backup_jobs
      ORDER BY created_at DESC
      LIMIT ${safeLimit}
      `,
    );
    return rows as Array<{
      job_id: number;
      trigger_source: string;
      triggered_by: number | null;
      status: string;
      backup_file_path: string | null;
      backup_file_size_bytes: number | null;
      duration_ms: number | null;
      error_message: string | null;
      started_at: Date;
      finished_at: Date | null;
      created_at: Date;
    }>;
  }
}

import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import db from '@config/database.js';

export type OpsJobRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export class OpsJobRunsRepository {
  static async createRun(input: {
    jobKey: string;
    triggerSource: string;
  }): Promise<number> {
    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO ops_job_runs (job_key, trigger_source, status)
       VALUES (?, ?, 'RUNNING')`,
      [input.jobKey, input.triggerSource],
    );
    return Number(result.insertId);
  }

  static async finishRun(input: {
    jobRunId: number;
    status: OpsJobRunStatus;
    summary?: unknown;
    errorMessage?: string | null;
  }): Promise<void> {
    await db.execute(
      `UPDATE ops_job_runs
       SET status = ?,
           summary_json = ?,
           error_message = ?,
           finished_at = NOW(),
           duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, NOW()) DIV 1000
       WHERE job_run_id = ?`,
      [
        input.status,
        input.summary === undefined ? null : JSON.stringify(input.summary),
        input.errorMessage?.slice(0, 2000) ?? null,
        input.jobRunId,
      ],
    );
  }

  static async findLatestRunsByJobKeys(jobKeys: string[]): Promise<
    Array<{
      job_run_id: number;
      job_key: string;
      trigger_source: string;
      status: OpsJobRunStatus;
      summary_json: unknown | null;
      error_message: string | null;
      started_at: Date;
      finished_at: Date | null;
      duration_ms: number | null;
    }>
  > {
    if (!jobKeys.length) return [];
    const placeholders = jobKeys.map(() => '?').join(',');
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT r.job_run_id, r.job_key, r.trigger_source, r.status, r.summary_json, r.error_message,
             r.started_at, r.finished_at, r.duration_ms
      FROM ops_job_runs r
      INNER JOIN (
        SELECT job_key, MAX(job_run_id) AS latest_job_run_id
        FROM ops_job_runs
        WHERE job_key IN (${placeholders})
        GROUP BY job_key
      ) latest
        ON latest.latest_job_run_id = r.job_run_id
      ORDER BY r.started_at DESC, r.job_run_id DESC
      `,
      jobKeys,
    );
    return rows.map((row) => ({
      job_run_id: Number(row.job_run_id),
      job_key: String(row.job_key),
      trigger_source: String(row.trigger_source),
      status: String(row.status) as OpsJobRunStatus,
      summary_json:
        typeof row.summary_json === 'string'
          ? JSON.parse(row.summary_json)
          : (row.summary_json ?? null),
      error_message: row.error_message ? String(row.error_message) : null,
      started_at: row.started_at as Date,
      finished_at: (row.finished_at as Date | null) ?? null,
      duration_ms: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    }));
  }

  static async countFailedRunsSince(jobKeys: string[], since: Date): Promise<number> {
    if (!jobKeys.length) return 0;
    const placeholders = jobKeys.map(() => '?').join(',');
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT COUNT(*) AS count
      FROM ops_job_runs
      WHERE job_key IN (${placeholders})
        AND status = 'FAILED'
        AND started_at >= ?
      `,
      [...jobKeys, since],
    );
    return Number((rows[0] as { count?: number } | undefined)?.count ?? 0);
  }
}

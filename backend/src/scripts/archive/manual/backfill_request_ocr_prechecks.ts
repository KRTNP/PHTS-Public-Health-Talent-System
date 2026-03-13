import mysql from "mysql2/promise";
import { loadEnv } from "@config/env.js";

loadEnv();

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "phts_system",
  port: Number.parseInt(process.env.DB_PORT || "3306", 10),
};

type LegacyOcrPrecheck = {
  status?: string | null;
  source?: string | null;
  service_url?: string | null;
  worker?: string | null;
  queued_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  count?: number | null;
  success_count?: number | null;
  failed_count?: number | null;
  error?: string | null;
  results?: unknown[] | null;
};

const normalizeDateTime = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
};

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT request_id, submission_data
      FROM req_submissions
      WHERE JSON_EXTRACT(submission_data, '$.ocr_precheck') IS NOT NULL
    `);

    let migrated = 0;
    for (const row of rows) {
      const rawSubmission =
        typeof row.submission_data === "string"
          ? JSON.parse(row.submission_data)
          : row.submission_data;
      const precheck = (rawSubmission?.ocr_precheck ?? null) as LegacyOcrPrecheck | null;
      if (!precheck?.status) continue;

      await connection.execute(
        `
          INSERT INTO req_ocr_prechecks (
            request_id,
            status,
            source,
            service_url,
            worker,
            queued_at,
            started_at,
            finished_at,
            count,
            success_count,
            failed_count,
            error,
            results_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            source = VALUES(source),
            service_url = VALUES(service_url),
            worker = VALUES(worker),
            queued_at = VALUES(queued_at),
            started_at = VALUES(started_at),
            finished_at = VALUES(finished_at),
            count = VALUES(count),
            success_count = VALUES(success_count),
            failed_count = VALUES(failed_count),
            error = VALUES(error),
            results_json = VALUES(results_json)
        `,
        [
          Number(row.request_id),
          String(precheck.status),
          precheck.source ?? null,
          precheck.service_url ?? null,
          precheck.worker ?? null,
          normalizeDateTime(precheck.queued_at),
          normalizeDateTime(precheck.started_at),
          normalizeDateTime(precheck.finished_at),
          Number(precheck.count ?? 0),
          Number(precheck.success_count ?? 0),
          Number(precheck.failed_count ?? 0),
          precheck.error ?? null,
          Array.isArray(precheck.results) ? JSON.stringify(precheck.results) : null,
        ],
      );
      migrated += 1;
    }

    console.log(`Backfilled OCR prechecks: ${migrated}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Failed to backfill OCR prechecks:", error);
  process.exit(1);
});

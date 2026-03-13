import { getConnection } from '@config/database.js';
import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';
import type {
  OcrBatchResultItem,
  OcrPrecheckHistoryItem,
  OcrPrecheckRecord,
} from '@/modules/ocr/entities/ocr-precheck.entity.js';

export class OcrRequestRepository {
  static async findStaleProcessingRequestIds(staleMinutes: number): Promise<number[]> {
    const connection = await getConnection();
    try {
      const safeMinutes = Number.isFinite(staleMinutes) ? Math.max(1, Math.floor(staleMinutes)) : 30;
      const [rows] = await connection.query<RowDataPacket[]>(
        `
          SELECT request_id
          FROM req_ocr_prechecks
          WHERE status = 'processing'
            AND finished_at IS NULL
            AND started_at IS NOT NULL
            AND started_at < (NOW() - INTERVAL ? MINUTE)
          ORDER BY started_at ASC
        `,
        [safeMinutes],
      );
      return rows
        .map((row) => Number(row.request_id))
        .filter((value) => Number.isInteger(value) && value > 0);
    } finally {
      connection.release();
    }
  }

  static async findRequestById(requestId: number) {
    return requestRepository.findById(requestId);
  }

  static async findAttachments(requestId: number) {
    return requestRepository.findAttachments(requestId);
  }

  static async findRequestPrecheck(requestId: number): Promise<OcrPrecheckRecord | null> {
    const connection = await getConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
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
            results_json,
            created_at,
            updated_at
          FROM req_ocr_prechecks
          WHERE request_id = ?
          LIMIT 1
        `,
        [requestId],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        request_id: Number(row.request_id),
        status: String(row.status) as OcrPrecheckRecord['status'],
        source: (row.source as string | null) ?? null,
        service_url: (row.service_url as string | null) ?? null,
        worker: (row.worker as string | null) ?? null,
        queued_at: row.queued_at ? new Date(row.queued_at).toISOString() : null,
        started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
        finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
        count: Number(row.count ?? 0),
        success_count: Number(row.success_count ?? 0),
        failed_count: Number(row.failed_count ?? 0),
        error: (row.error as string | null) ?? null,
        results:
          typeof row.results_json === 'string' && row.results_json.trim()
            ? (JSON.parse(row.results_json) as OcrBatchResultItem[])
            : [],
        created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      };
    } finally {
      connection.release();
    }
  }

  static async upsertRequestPrecheck(
    requestId: number,
    patch: Record<string, unknown>,
    connection?: PoolConnection,
  ): Promise<void> {
    const db = connection ?? (await getConnection());
    const shouldRelease = !connection;
    try {
      const existing = await this.findRequestPrecheckForWrite(requestId, connection ?? db);
      const merged = {
        ...existing,
        ...patch,
      } as Record<string, unknown>;

      await db.execute(
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
          requestId,
          String(merged.status ?? 'queued'),
          (merged.source as string | null) ?? null,
          (merged.service_url as string | null) ?? null,
          (merged.worker as string | null) ?? null,
          this.normalizeDateTimeValue(merged.queued_at),
          this.normalizeDateTimeValue(merged.started_at),
          this.normalizeDateTimeValue(merged.finished_at),
          Number(merged.count ?? 0),
          Number(merged.success_count ?? 0),
          Number(merged.failed_count ?? 0),
          (merged.error as string | null) ?? null,
          Array.isArray(merged.results) ? JSON.stringify(merged.results) : null,
        ],
      );
    } finally {
      if (shouldRelease) {
        db.release();
      }
    }
  }

  static async updateRequestPrecheck(requestId: number, patch: Record<string, unknown>): Promise<void> {
    try {
      await this.upsertRequestPrecheck(requestId, patch);
    } catch {
      throw new Error('Failed to update OCR precheck');
    }
  }

  static async findRequestPrecheckHistory(params: {
    page: number;
    limit: number;
    status?: string | null;
    search?: string | null;
  }): Promise<{ items: OcrPrecheckHistoryItem[]; total: number }> {
    const connection = await getConnection();
    try {
      const page = Math.max(1, Number(params.page || 1));
      const limit = Math.min(100, Math.max(1, Number(params.limit || 20)));
      const offset = (page - 1) * limit;
      const where: string[] = [];
      const values: Array<string | number> = [];

      if (params.status) {
        where.push('ocr.status = ?');
        values.push(params.status);
      }

      if (params.search?.trim()) {
        const keyword = `%${params.search.trim()}%`;
        where.push(`
          (
            rs.request_no LIKE ?
            OR CONCAT(COALESCE(ep.first_name, ''), ' ', COALESCE(ep.last_name, '')) LIKE ?
            OR ep.department LIKE ?
            OR ep.sub_department LIKE ?
          )
        `);
        values.push(keyword, keyword, keyword, keyword);
      }

      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const [rows] = await connection.query<RowDataPacket[]>(
        `
          SELECT
            ocr.request_id,
            ocr.status,
            ocr.source,
            ocr.service_url,
            ocr.worker,
            ocr.queued_at,
            ocr.started_at,
            ocr.finished_at,
            ocr.count,
            ocr.success_count,
            ocr.failed_count,
            ocr.error,
            ocr.results_json,
            ocr.created_at,
            ocr.updated_at,
            rs.request_no,
            rs.status AS request_status,
            rs.request_type,
            NULLIF(TRIM(CONCAT(COALESCE(ep.first_name, ''), ' ', COALESCE(ep.last_name, ''))), '') AS requester_name,
            COALESCE(ep.sub_department, ep.department) AS department
          FROM req_ocr_prechecks ocr
          LEFT JOIN req_submissions rs ON rs.request_id = ocr.request_id
          LEFT JOIN emp_profiles ep ON ep.citizen_id = rs.citizen_id
          ${whereSql}
          ORDER BY COALESCE(ocr.updated_at, ocr.created_at) DESC, ocr.request_id DESC
          LIMIT ? OFFSET ?
        `,
        [...values, limit, offset],
      );

      const [countRows] = await connection.query<RowDataPacket[]>(
        `
          SELECT COUNT(*) AS total
          FROM req_ocr_prechecks ocr
          LEFT JOIN req_submissions rs ON rs.request_id = ocr.request_id
          LEFT JOIN emp_profiles ep ON ep.citizen_id = rs.citizen_id
          ${whereSql}
        `,
        values,
      );

      return {
        items: rows.map((row) => ({
          ...(() => {
            const parsedResults =
              typeof row.results_json === 'string' && row.results_json.trim()
                ? (JSON.parse(row.results_json) as OcrBatchResultItem[])
                : [];
            const firstSuccess = parsedResults.find((item) => item.ok) ?? null;
            return {
              results: parsedResults,
              engine_used: (firstSuccess?.engine_used as string | undefined) ?? null,
              fallback_used:
                typeof firstSuccess?.fallback_used === 'boolean'
                  ? firstSuccess.fallback_used
                  : null,
              document_kind: (firstSuccess?.document_kind as string | undefined) ?? null,
              fields:
                firstSuccess?.fields && typeof firstSuccess.fields === 'object'
                  ? firstSuccess.fields
                  : null,
              missing_fields: Array.isArray(firstSuccess?.missing_fields)
                ? firstSuccess.missing_fields
                : null,
              fallback_reason: (firstSuccess?.fallback_reason as string | undefined) ?? null,
              quality:
                firstSuccess?.quality && typeof firstSuccess.quality === 'object'
                  ? firstSuccess.quality
                  : null,
            };
          })(),
          request_id: Number(row.request_id),
          status: String(row.status) as OcrPrecheckRecord['status'],
          source: (row.source as string | null) ?? null,
          service_url: (row.service_url as string | null) ?? null,
          worker: (row.worker as string | null) ?? null,
          queued_at: row.queued_at ? new Date(row.queued_at).toISOString() : null,
          started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
          finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
          count: Number(row.count ?? 0),
          success_count: Number(row.success_count ?? 0),
          failed_count: Number(row.failed_count ?? 0),
          error: (row.error as string | null) ?? null,
          created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
          updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
          request_no: (row.request_no as string | null) ?? null,
          request_status: (row.request_status as string | null) ?? null,
          request_type: (row.request_type as string | null) ?? null,
          requester_name: (row.requester_name as string | null) ?? null,
          department: (row.department as string | null) ?? null,
        })),
        total: Number(countRows[0]?.total ?? 0),
      };
    } finally {
      connection.release();
    }
  }

  private static async findRequestPrecheckForWrite(
    requestId: number,
    connection: PoolConnection,
  ): Promise<Record<string, unknown>> {
    const [rows] = await connection.query<RowDataPacket[]>(
      `
        SELECT
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
        FROM req_ocr_prechecks
        WHERE request_id = ?
        LIMIT 1
      `,
      [requestId],
    );
    const row = rows[0];
    if (!row) return {};
    return {
      request_id: Number(row.request_id),
      status: row.status,
      source: row.source,
      service_url: row.service_url,
      worker: row.worker,
      queued_at: row.queued_at ? new Date(row.queued_at).toISOString() : null,
      started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
      finished_at: row.finished_at ? new Date(row.finished_at).toISOString() : null,
      count: Number(row.count ?? 0),
      success_count: Number(row.success_count ?? 0),
      failed_count: Number(row.failed_count ?? 0),
      error: row.error ?? null,
      results:
        typeof row.results_json === 'string' && row.results_json.trim()
          ? (JSON.parse(row.results_json) as OcrBatchResultItem[])
          : [],
    };
  }

  private static normalizeDateTimeValue(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }
}

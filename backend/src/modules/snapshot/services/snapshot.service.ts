/**
 * PHTS System - Snapshot Freeze Service
 *
 * Handles monthly snapshot freezing.
 * FR-12-01: Lock monthly snapshots when period is closed
 * FR-12-02: Reports must reference frozen snapshots only
 */

import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { SnapshotRepository } from '@/modules/snapshot/repositories/snapshot.repository.js';

/**
 * Snapshot type
 */
export enum SnapshotType {
  PAYOUT = "PAYOUT",
  SUMMARY = "SUMMARY",
}

export enum SnapshotStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  READY = "READY",
  FAILED = "FAILED",
}

const DEFAULT_SNAPSHOT_MAX_ATTEMPTS = 8;
const DEFAULT_SNAPSHOT_RETRY_BASE_SECONDS = 30;
const DEFAULT_SNAPSHOT_RETRY_MAX_SECONDS = 1800;
const DEFAULT_SNAPSHOT_PROCESSING_TIMEOUT_SECONDS = 300;

const toSafeInt = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

const getSnapshotMaxAttempts = (): number =>
  toSafeInt(process.env.SNAPSHOT_OUTBOX_MAX_ATTEMPTS, DEFAULT_SNAPSHOT_MAX_ATTEMPTS, 1, 100);

const getSnapshotRetryBaseSeconds = (): number =>
  toSafeInt(
    process.env.SNAPSHOT_OUTBOX_RETRY_BASE_SECONDS,
    DEFAULT_SNAPSHOT_RETRY_BASE_SECONDS,
    1,
    3600,
  );

const getSnapshotRetryMaxSeconds = (): number => {
  const maxSeconds = toSafeInt(
    process.env.SNAPSHOT_OUTBOX_RETRY_MAX_SECONDS,
    DEFAULT_SNAPSHOT_RETRY_MAX_SECONDS,
    1,
    7 * 24 * 3600,
  );
  return Math.max(getSnapshotRetryBaseSeconds(), maxSeconds);
};

const getSnapshotProcessingTimeoutSeconds = (): number =>
  toSafeInt(
    process.env.SNAPSHOT_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
    DEFAULT_SNAPSHOT_PROCESSING_TIMEOUT_SECONDS,
    30,
    24 * 3600,
  );

/**
 * Period with snapshot info
 */
export interface PeriodWithSnapshot {
  period_id: number;
  period_month: number;
  period_year: number;
  status: string;
  is_locked?: boolean;
  snapshot_status?: SnapshotStatus;
  snapshot_ready_at?: Date | null;
  frozen_at: Date | null;
  frozen_by: number | null;
  snapshot_count: number;
}

/**
 * Snapshot record
 */
export interface Snapshot {
  snapshot_id: number;
  period_id: number;
  snapshot_type: SnapshotType;
  snapshot_data: any;
  record_count: number;
  total_amount: number;
  created_at: Date;
}

function resolveSnapshotStatus(row: any): SnapshotStatus {
  const fromNew = String(row?.snapshot_status ?? "").toUpperCase();
  if (
    fromNew === SnapshotStatus.PENDING ||
    fromNew === SnapshotStatus.PROCESSING ||
    fromNew === SnapshotStatus.READY ||
    fromNew === SnapshotStatus.FAILED
  ) {
    return fromNew as SnapshotStatus;
  }
  return SnapshotStatus.PENDING;
}

function isSnapshotReady(period: PeriodWithSnapshot): boolean {
  return resolveSnapshotStatus(period as any) === SnapshotStatus.READY;
}

/**
 * Get period with snapshot info
 */
export async function getPeriodWithSnapshot(
  periodId: number,
): Promise<PeriodWithSnapshot | null> {
  const row = await SnapshotRepository.findPeriodWithSnapshot(periodId);
  if (!row) return null;
  return {
    period_id: row.period_id,
    period_month: row.period_month,
    period_year: row.period_year,
    status: row.status,
    is_locked: Boolean(row.is_locked),
    snapshot_status: resolveSnapshotStatus(row),
    snapshot_ready_at: row.snapshot_ready_at ?? null,
    frozen_at: row.frozen_at,
    frozen_by: row.frozen_by,
    snapshot_count: row.snapshot_count,
  };
}

/**
 * Check if period snapshot is ready
 */
export async function isPeriodFrozen(periodId: number): Promise<boolean> {
  return SnapshotRepository.isPeriodFrozen(periodId);
}

/**
 * Freeze a period's snapshot
 */
export async function freezePeriod(
  periodId: number,
  frozenBy: number,
): Promise<void> {
  await enqueuePeriodSnapshotGeneration(periodId, frozenBy);
}

export async function enqueuePeriodSnapshotGeneration(
  periodId: number,
  requestedBy: number | null,
): Promise<void> {
  const connection = await SnapshotRepository.getConnection();
  try {
    await connection.beginTransaction();
    const period = await SnapshotRepository.findPeriodByIdForUpdate(periodId, connection);
    if (!period) {
      throw new Error("Period not found");
    }
    if (String(period.status ?? "").toUpperCase() !== "CLOSED") {
      throw new Error("Can only enqueue snapshot for closed periods");
    }
    await SnapshotRepository.setPeriodSnapshotPending(periodId, connection);
    await SnapshotRepository.insertSnapshotOutbox(periodId, requestedBy, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Helper to calculate department summary
 */
function calculateDepartmentSummary(
  payouts: any[],
): { department: string; count: number; amount: number }[] {
  const deptMap: Record<string, { count: number; amount: number }> = {};

  for (const payout of payouts) {
    const dept = payout.department || "Unknown";
    if (!deptMap[dept]) {
      deptMap[dept] = { count: 0, amount: 0 };
    }
    deptMap[dept].count++;
    deptMap[dept].amount += Number(payout.total_payable ?? 0);
  }

  return Object.entries(deptMap)
    .map(([department, data]) => ({
      department,
      count: data.count,
      amount: data.amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export async function processSnapshotOutboxBatch(limit = 50): Promise<{
  processed: number;
  sent: number;
  failed: number;
  requeued: number;
}> {
  const maxAttempts = getSnapshotMaxAttempts();
  const retryBaseSeconds = getSnapshotRetryBaseSeconds();
  const retryMaxSeconds = getSnapshotRetryMaxSeconds();
  const processingTimeoutSeconds = getSnapshotProcessingTimeoutSeconds();
  const conn = await SnapshotRepository.getConnection();
  let processed = 0;
  let sent = 0;
  let failed = 0;
  let requeued = 0;
  try {
    await conn.beginTransaction();
    requeued = await SnapshotRepository.reclaimStuckProcessing(
      processingTimeoutSeconds,
      maxAttempts,
      retryBaseSeconds,
      retryMaxSeconds,
      conn,
    );
    const rows = await SnapshotRepository.findOutboxBatchForUpdate(limit, maxAttempts, conn);

    for (const row of rows as any[]) {
      processed += 1;
      const outboxId = Number(row.outbox_id);
      const periodId = Number(row.period_id);
      const requestedBy =
        row.requested_by === null || row.requested_by === undefined
          ? null
          : Number(row.requested_by);
      try {
        await SnapshotRepository.markOutboxProcessing(outboxId, conn);
        await generateSnapshotForPeriod(conn, periodId, requestedBy);
        await SnapshotRepository.markOutboxSent(outboxId, conn);
        sent += 1;
      } catch (error: any) {
        failed += 1;
        await SnapshotRepository.markOutboxFailed(
          outboxId,
          String(error?.message ?? "snapshot generation failed"),
          maxAttempts,
          retryBaseSeconds,
          retryMaxSeconds,
          conn,
        );
        await SnapshotRepository.setPeriodSnapshotFailed(periodId, conn);
        await emitAuditEvent({
          eventType: AuditEventType.OTHER,
          entityType: "snapshot",
          entityId: periodId,
          actorId: requestedBy,
          actionDetail: {
            code: "SNAPSHOT_GENERATION_FAILED",
            period_id: periodId,
            message: error?.message ?? String(error),
          },
        }, conn);
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

async function generateSnapshotForPeriod(
  connection: Awaited<ReturnType<typeof SnapshotRepository.getConnection>>,
  periodId: number,
  requestedBy: number | null,
): Promise<void> {
  const period = await SnapshotRepository.findPeriodByIdForUpdate(periodId, connection);
  if (!period) throw new Error("Period not found");
  if (String(period.status ?? "").toUpperCase() !== "CLOSED") {
    throw new Error("Can only freeze closed periods");
  }

  await SnapshotRepository.setPeriodSnapshotProcessing(periodId, connection);
  const payouts = await SnapshotRepository.findPayoutsForSnapshot(periodId, connection);

  let totalAmount = 0;
  for (const payout of payouts as any[]) {
    totalAmount += Number(payout.total_payable ?? 0);
  }

  await SnapshotRepository.deleteSnapshotsForPeriod(periodId, connection);
  await SnapshotRepository.createSnapshot(
    periodId,
    SnapshotType.PAYOUT,
    payouts,
    payouts.length,
    totalAmount,
    connection,
  );

  const summary = {
    period_id: periodId,
    period_month: period.period_month,
    period_year: period.period_year,
    total_employees: payouts.length,
    total_amount: totalAmount,
    frozen_at: new Date().toISOString(),
    by_department: calculateDepartmentSummary(payouts as any[]),
  };
  await SnapshotRepository.createSnapshot(
    periodId,
    SnapshotType.SUMMARY,
    summary,
    payouts.length,
    totalAmount,
    connection,
  );

  await SnapshotRepository.setPeriodSnapshotReady({
    periodId,
    frozenBy: requestedBy,
    conn: connection,
  });

  await emitAuditEvent({
    eventType: AuditEventType.SNAPSHOT_FREEZE,
    entityType: "period",
    entityId: periodId,
    actorId: requestedBy,
    actionDetail: {
      period_month: period.period_month,
      period_year: period.period_year,
      record_count: payouts.length,
      total_amount: totalAmount,
      status: "READY",
    },
  }, connection);
}

/**
 * Get snapshot data
 */
export async function getSnapshot(
  periodId: number,
  snapshotType: SnapshotType,
): Promise<Snapshot | null> {
  return SnapshotRepository.findSnapshot(periodId, snapshotType);
}

/**
 * Get payout data for report (snapshot-only gate)
 */
export async function getPayoutDataForReport(periodId: number): Promise<{
  source: "snapshot";
  data: any[];
  recordCount: number;
  totalAmount: number;
}> {
  const period = await getPeriodWithSnapshot(periodId);
  if (!period) {
    throw new Error("Period not found");
  }
  if (period.status !== "CLOSED") {
    throw new Error("Report is available only for closed periods");
  }
  if (!isSnapshotReady(period)) {
    throw new Error("SNAPSHOT_NOT_READY");
  }

  const snapshot = await getSnapshot(periodId, SnapshotType.PAYOUT);

  if (!snapshot) {
    throw new Error("SNAPSHOT_NOT_READY");
  }

  return {
    source: "snapshot",
    data: snapshot.snapshot_data,
    recordCount: snapshot.record_count,
    totalAmount: snapshot.total_amount,
  };
}

/**
 * Get summary data for report (snapshot-only gate)
 */
export async function getSummaryDataForReport(periodId: number): Promise<{
  source: "snapshot";
  data: any;
}> {
  const period = await getPeriodWithSnapshot(periodId);
  if (!period) {
    throw new Error("Period not found");
  }
  if (period.status !== "CLOSED") {
    throw new Error("Report is available only for closed periods");
  }
  if (!isSnapshotReady(period)) {
    throw new Error("SNAPSHOT_NOT_READY");
  }

  const snapshot = await getSnapshot(periodId, SnapshotType.SUMMARY);

  if (!snapshot) {
    throw new Error("SNAPSHOT_NOT_READY");
  }

  return {
    source: "snapshot",
    data: snapshot.snapshot_data,
  };
}

/**
 * Unfreeze a period (admin only, for corrections)
 */
export async function unfreezePeriod(
  periodId: number,
  unfrozenBy: number,
  reason: string,
): Promise<void> {
  if (!reason || reason.trim() === "") {
    throw new Error("Reason is required for unfreezing");
  }

  const connection = await SnapshotRepository.getConnection();

  try {
    await connection.beginTransaction();

    // Check period snapshot is currently ready
    const period = await SnapshotRepository.findPeriodByIdForUpdate(periodId, connection);
    if (!period) {
      throw new Error("Period not found");
    }

    if (resolveSnapshotStatus(period) !== SnapshotStatus.READY) {
      throw new Error("Period is not frozen");
    }

    // Unfreeze (keep snapshots for audit trail)
    await SnapshotRepository.unfreezePeriod(periodId, connection);

    await connection.commit();

    // Log audit
    await emitAuditEvent({
      eventType: AuditEventType.SNAPSHOT_UNFREEZE,
      entityType: "period",
      entityId: periodId,
      actorId: unfrozenBy,
      actionDetail: {
        period_month: period.period_month,
        period_year: period.period_year,
        reason,
      },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get all snapshots for a period
 */
export async function getSnapshotsForPeriod(
  periodId: number,
): Promise<Snapshot[]> {
  return SnapshotRepository.findSnapshotsForPeriod(periodId);
}

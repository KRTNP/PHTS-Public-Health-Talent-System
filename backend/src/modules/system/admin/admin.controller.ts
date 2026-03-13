/**
 * system module - request orchestration
 *
 */
import { Request, Response } from "express";
import { asyncHandler } from "@middlewares/errorHandler.js";
import { AdminRepository } from "@/modules/system/repositories/admin.repository.js";
import {
  isMaintenanceModeEnabled,
  disableMaintenanceMode,
  enableMaintenanceMode,
} from "@/modules/system/services/maintenance.service.js";
import { getJobStatus as getSystemJobStatus } from "@/modules/system/services/jobs.service.js";
import {
  emitAuditEvent,
  AuditEventType,
} from "@/modules/audit/services/audit.service.js";
import { SnapshotRepository } from "@/modules/snapshot/repositories/snapshot.repository.js";
import { NotificationOutboxRepository } from "@/modules/notification/repositories/notification-outbox.repository.js";
import type {
  SearchUsersQuery,
  GetUserByIdParams,
  UpdateUserRoleParams,
  UpdateUserRoleBody,
  ToggleMaintenanceModeBody,
  GetSnapshotOutboxQuery,
  GetNotificationOutboxQuery,
  RetryNotificationOutboxParams,
  RetrySnapshotOutboxParams,
} from "@/modules/system/admin/admin.schema.js";

export const searchUsers = asyncHandler(async (req: Request, res: Response) => {
  const { q, page, limit, role, is_active } = req.query as SearchUsersQuery;
  const result = await AdminRepository.searchUsers({
    q: q || "",
    page: Number(page || 1),
    limit: Number(limit || 20),
    role,
    isActive: is_active === undefined ? undefined : Number(is_active),
  });
  res.json({ success: true, data: result });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params as unknown as GetUserByIdParams;
  const row = await AdminRepository.findUserById(Number(userId));
  if (!row) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }
  res.json({ success: true, data: row });
});

export const updateUserRole = asyncHandler(
  async (req: Request, res: Response) => {
    const { userId } = req.params as unknown as UpdateUserRoleParams;
    const { role, is_active } = req.body as UpdateUserRoleBody;
    const actorId = req.user?.userId ?? null;

    await AdminRepository.updateUserRole(Number(userId), role, is_active);

    await emitAuditEvent({
      eventType: AuditEventType.USER_ROLE_CHANGE,
      entityType: "USER",
      entityId: Number(userId),
      actorId,
      actionDetail: { role, isActive: is_active },
    });

    res.json({ success: true, message: "User role updated successfully" });
  },
);

export const toggleMaintenanceMode = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = req.body as ToggleMaintenanceModeBody;
    if (enabled) {
      await enableMaintenanceMode();
    } else {
      await disableMaintenanceMode();
    }
    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? "enabled" : "disabled"}`,
      data: { enabled: Boolean(enabled) },
    });
  },
);

export const getMaintenanceMode = asyncHandler(
  async (_req: Request, res: Response) => {
    const enabled = await isMaintenanceModeEnabled();
    res.json({
      success: true,
      data: { enabled },
    });
  },
);

export const getJobStatus = asyncHandler(
  async (_req: Request, res: Response) => {
    const data = await getSystemJobStatus();
    res.json({ success: true, data });
  },
);

export const getVersionInfo = asyncHandler(
  async (_req: Request, res: Response) => {
    const version = process.env.APP_VERSION ?? "unknown";
    const commit = process.env.APP_COMMIT ?? "unknown";
    const env = process.env.NODE_ENV ?? "development";
    res.json({
      success: true,
      data: {
        version,
        commit,
        env,
      },
    });
  },
);

const getSnapshotMaxAttempts = (): number => {
  const raw = Number(process.env.SNAPSHOT_OUTBOX_MAX_ATTEMPTS ?? 8);
  if (!Number.isFinite(raw)) return 8;
  return Math.max(1, Math.min(100, Math.floor(raw)));
};

const getNotificationMaxAttempts = (): number => {
  const raw = Number(process.env.NOTIFICATION_OUTBOX_MAX_ATTEMPTS ?? 8);
  if (!Number.isFinite(raw)) return 8;
  return Math.max(1, Math.min(100, Math.floor(raw)));
};

export const getNotificationOutbox = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, status } = req.query as GetNotificationOutboxQuery;
  const data = await NotificationOutboxRepository.findOutboxRows({
    page: Number(page || 1),
    limit: Number(limit || 10),
    status,
    maxAttempts: getNotificationMaxAttempts(),
  });
  res.json({ success: true, data });
});

export const retryNotificationOutbox = asyncHandler(async (req: Request, res: Response) => {
  const { outboxId } = req.params as unknown as RetryNotificationOutboxParams;
  const ok = await NotificationOutboxRepository.retryOutboxRow(Number(outboxId));
  if (!ok) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOTIFICATION_OUTBOX_NOT_RETRYABLE',
        message: 'ไม่พบรายการที่ลองใหม่ได้',
      },
    });
    return;
  }
  res.json({ success: true, message: 'นำรายการกลับเข้าคิวแล้ว' });
});

export const retryNotificationDeadLetters = asyncHandler(async (_req: Request, res: Response) => {
  const count = await NotificationOutboxRepository.retryDeadLetterRows(getNotificationMaxAttempts());
  res.json({
    success: true,
    data: { count },
    message: count > 0 ? `นำกลับเข้าคิว ${count} รายการแล้ว` : 'ไม่มี dead-letter ที่ต้องลองใหม่',
  });
});

export const getSnapshotOutbox = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, status, period_id } = req.query as GetSnapshotOutboxQuery;
  const data = await SnapshotRepository.findSnapshotOutboxRows({
    page: Number(page || 1),
    limit: Number(limit || 10),
    status,
    periodId: period_id ? Number(period_id) : undefined,
    maxAttempts: getSnapshotMaxAttempts(),
  });
  res.json({ success: true, data });
});

export const retrySnapshotOutbox = asyncHandler(async (req: Request, res: Response) => {
  const { outboxId } = req.params as unknown as RetrySnapshotOutboxParams;
  const ok = await SnapshotRepository.retryOutboxRow(Number(outboxId));
  if (!ok) {
    res.status(404).json({
      success: false,
      error: {
        code: 'SNAPSHOT_OUTBOX_NOT_RETRYABLE',
        message: 'ไม่พบรายการที่ลองใหม่ได้',
      },
    });
    return;
  }
  res.json({ success: true, message: 'นำรายการกลับเข้าคิวแล้ว' });
});

export const retrySnapshotDeadLetters = asyncHandler(async (_req: Request, res: Response) => {
  const count = await SnapshotRepository.retryDeadLetterRows(getSnapshotMaxAttempts());
  res.json({
    success: true,
    data: { count },
    message: count > 0 ? `นำกลับเข้าคิว ${count} รายการแล้ว` : 'ไม่มี dead-letter ที่ต้องลองใหม่',
  });
});

/**
 * system module - route map
 *
 */
import { Router } from "express";
import { protect, restrictTo } from "@middlewares/authMiddleware.js";
import { validate } from "@shared/validate.middleware.js";
import { UserRole } from "@/types/auth.js";
import * as systemController from "@/modules/system/admin/admin.controller.js";
import syncRoutes from "@/modules/sync/sync.routes.js";
import backupRoutes from "@/modules/backup/backup.routes.js";
import {
  searchUsersSchema,
  getUserByIdSchema,
  updateUserRoleSchema,
  toggleMaintenanceModeSchema,
  getSnapshotOutboxSchema,
  getNotificationOutboxSchema,
  retryNotificationOutboxSchema,
  retrySnapshotOutboxSchema,
  } from "@/modules/system/admin/admin.schema.js";

const router = Router();

// All routes require authentication
router.use(protect);

// Admin only
const adminAuth = restrictTo(UserRole.ADMIN);

router.get(
  "/users",
  adminAuth,
  validate(searchUsersSchema),
  systemController.searchUsers,
);
router.get(
  "/users/:userId",
  adminAuth,
  validate(getUserByIdSchema),
  systemController.getUserById,
);
router.put(
  "/users/:userId/role",
  adminAuth,
  validate(updateUserRoleSchema),
  systemController.updateUserRole,
);

router.post(
  "/maintenance",
  adminAuth,
  validate(toggleMaintenanceModeSchema),
  systemController.toggleMaintenanceMode,
);
router.get("/maintenance", adminAuth, systemController.getMaintenanceMode);
router.get("/jobs", adminAuth, systemController.getJobStatus);
router.get("/version", adminAuth, systemController.getVersionInfo);
router.get(
  "/notification-outbox",
  adminAuth,
  validate(getNotificationOutboxSchema),
  systemController.getNotificationOutbox,
);
router.post(
  "/notification-outbox/retry-dead-letter",
  adminAuth,
  systemController.retryNotificationDeadLetters,
);
router.post(
  "/notification-outbox/:outboxId/retry",
  adminAuth,
  validate(retryNotificationOutboxSchema),
  systemController.retryNotificationOutbox,
);
router.get(
  "/snapshot-outbox",
  adminAuth,
  validate(getSnapshotOutboxSchema),
  systemController.getSnapshotOutbox,
);
router.post(
  "/snapshot-outbox/retry-dead-letter",
  adminAuth,
  systemController.retrySnapshotDeadLetters,
);
router.post(
  "/snapshot-outbox/:outboxId/retry",
  adminAuth,
  validate(retrySnapshotOutboxSchema),
  systemController.retrySnapshotOutbox,
);
router.use(syncRoutes);
router.use(backupRoutes);

export default router;

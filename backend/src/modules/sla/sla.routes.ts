/**
 * PHTS System - SLA Routes
 *
 * API routes for SLA operations.
 */

import { Router } from "express";
import { protect, restrictTo } from '@middlewares/authMiddleware.js';
import { validate } from '@shared/validate.middleware.js';
import { UserRole } from '@/types/auth.js';
import * as slaController from '@/modules/sla/sla.controller.js';
import {
  updateSLAConfigSchema,
  calculateBusinessDaysSchema,
} from '@/modules/sla/sla.schema.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

// Get SLA configurations (PTS_OFFICER, ADMIN)
router.get(
  "/config",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_SCOPE,
    UserRole.ADMIN,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
  ),
  slaController.getSLAConfigsHandler,
);

// Update SLA configuration (ADMIN only)
router.put(
  "/config/:stepNo",
  restrictTo(UserRole.ADMIN),
  validate(updateSLAConfigSchema),
  slaController.updateSLAConfigHandler,
);

// Get SLA report (PTS_OFFICER, HEAD_HR, DIRECTOR, ADMIN)
router.get(
  "/report",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_SCOPE,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAReportHandler,
);

router.get(
  "/kpi/overview",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_SCOPE,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiOverviewHandler,
);

router.get(
  "/kpi/by-step",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_SCOPE,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiByStepHandler,
);

router.get(
  "/kpi/backlog-aging",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_SCOPE,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiBacklogAgingHandler,
);

router.get(
  "/kpi/data-quality",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_SCOPE,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiDataQualityHandler,
);

router.get(
  "/kpi/error",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_SCOPE,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  slaController.getSLAKpiErrorOverviewHandler,
);

// Get pending requests with SLA info (PTS_OFFICER, ADMIN)
router.get(
  "/pending",
  restrictTo(
    UserRole.PTS_OFFICER,
    UserRole.HEAD_SCOPE,
    UserRole.ADMIN,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
  ),
  slaController.getPendingRequestsWithSLAHandler,
);

// Manual trigger for reminders (ADMIN only)
router.post(
  "/send-reminders",
  restrictTo(UserRole.ADMIN),
  slaController.sendRemindersHandler,
);

// Calculate business days utility
router.get(
  "/calculate-days",
  restrictTo(UserRole.PTS_OFFICER, UserRole.HEAD_SCOPE, UserRole.ADMIN),
  validate(calculateBusinessDaysSchema),
  slaController.calculateBusinessDaysHandler,
);

export default router;

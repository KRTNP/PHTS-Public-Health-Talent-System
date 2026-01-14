/**
 * PHTS System - Snapshot Routes
 *
 * API routes for snapshot operations.
 */

import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/authMiddleware.js';
import { UserRole } from '../../types/auth.js';
import * as snapshotController from './snapshot.controller.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

// Roles that can view snapshot info
const viewRoles = [
  UserRole.PTS_OFFICER,
  UserRole.HEAD_HR,
  UserRole.HEAD_FINANCE,
  UserRole.FINANCE_OFFICER,
  UserRole.DIRECTOR,
  UserRole.ADMIN,
];

// Roles that can freeze periods
const freezeRoles = [UserRole.PTS_OFFICER, UserRole.DIRECTOR, UserRole.ADMIN];

// Get period with snapshot info
router.get('/periods/:id', restrictTo(...viewRoles), snapshotController.getPeriodWithSnapshot);

// Check if period is frozen
router.get('/periods/:id/is-frozen', restrictTo(...viewRoles), snapshotController.checkFrozen);

// Get all snapshots for a period
router.get('/periods/:id/snapshots', restrictTo(...viewRoles), snapshotController.getSnapshotsForPeriod);

// Get specific snapshot by type
router.get('/periods/:id/snapshot/:type', restrictTo(...viewRoles), snapshotController.getSnapshot);

// Get report data (respects freeze)
router.get('/periods/:id/report-data', restrictTo(...viewRoles), snapshotController.getReportData);

// Get summary data (respects freeze)
router.get('/periods/:id/summary-data', restrictTo(...viewRoles), snapshotController.getSummaryData);

// Freeze a period
router.post('/periods/:id/freeze', restrictTo(...freezeRoles), snapshotController.freezePeriod);

// Unfreeze a period (admin only)
router.post('/periods/:id/unfreeze', restrictTo(UserRole.ADMIN), snapshotController.unfreezePeriod);

export default router;

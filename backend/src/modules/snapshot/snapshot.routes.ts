/**
 * PHTS System - Snapshot Routes
 *
 * API routes for snapshot operations.
 * Per Access_Control_Matrix.txt Line 182: PTS_OFFICER เท่านั้น
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

/**
 * Snapshot access is restricted to PTS_OFFICER only
 * Per Access_Control_Matrix.txt: "ล็อก Snapshot รายเดือนก่อน Export - PTS_OFFICER เท่านั้น"
 */

// Get period with snapshot info
router.get('/periods/:id', restrictTo(UserRole.PTS_OFFICER), snapshotController.getPeriodWithSnapshot);

// Check if period is frozen
router.get('/periods/:id/is-frozen', restrictTo(UserRole.PTS_OFFICER), snapshotController.checkFrozen);

// Get all snapshots for a period
router.get('/periods/:id/snapshots', restrictTo(UserRole.PTS_OFFICER), snapshotController.getSnapshotsForPeriod);

// Get specific snapshot by type
router.get('/periods/:id/snapshot/:type', restrictTo(UserRole.PTS_OFFICER), snapshotController.getSnapshot);

// Get report data (respects freeze)
router.get('/periods/:id/report-data', restrictTo(UserRole.PTS_OFFICER), snapshotController.getReportData);

// Get summary data (respects freeze)
router.get('/periods/:id/summary-data', restrictTo(UserRole.PTS_OFFICER), snapshotController.getSummaryData);

// Freeze a period
router.post('/periods/:id/freeze', restrictTo(UserRole.PTS_OFFICER), snapshotController.freezePeriod);

// Unfreeze a period (PTS_OFFICER only - requires reason)
router.post('/periods/:id/unfreeze', restrictTo(UserRole.PTS_OFFICER), snapshotController.unfreezePeriod);

export default router;

/**
 * PHTS System - Finance Routes
 *
 * API routes for finance operations (payment status, dashboard).
 */

import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/authMiddleware.js';
import { UserRole } from '../../types/auth.js';
import * as financeController from './finance.controller.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Dashboard & Summary Routes
 * Per Access_Control_Matrix.txt: Dashboard และ Paid status เป็นสิทธิ์ของ FINANCE_OFFICER เท่านั้น
 */

// Finance dashboard overview
router.get(
  '/dashboard',
  restrictTo(UserRole.FINANCE_OFFICER),
  financeController.getDashboard,
);

// Finance summary with filters
router.get(
  '/summary',
  restrictTo(UserRole.FINANCE_OFFICER),
  financeController.getSummary,
);

// Yearly summary
router.get(
  '/yearly',
  restrictTo(UserRole.FINANCE_OFFICER),
  financeController.getYearlySummary,
);

// Get payouts for a specific period
router.get(
  '/periods/:periodId/payouts',
  restrictTo(UserRole.FINANCE_OFFICER),
  financeController.getPayoutsByPeriod,
);

/**
 * Payment Status Routes
 * Only FINANCE_OFFICER can mark as paid
 */

// Mark single payout as paid
router.post(
  '/payouts/:payoutId/mark-paid',
  restrictTo(UserRole.FINANCE_OFFICER),
  financeController.markAsPaid,
);

// Batch mark as paid
router.post(
  '/payouts/batch-mark-paid',
  restrictTo(UserRole.FINANCE_OFFICER),
  financeController.batchMarkAsPaid,
);

// Cancel a payout
router.post(
  '/payouts/:payoutId/cancel',
  restrictTo(UserRole.FINANCE_OFFICER, UserRole.HEAD_FINANCE),
  financeController.cancelPayout,
);

export default router;

/**
 * PHTS System - Audit Trail Routes
 *
 * API routes for audit trail operations.
 * Access restricted to ADMIN, PTS_OFFICER
 */

import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/authMiddleware.js';
import { UserRole } from '../../types/auth.js';
import * as auditController from './audit.controller.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Audit trail access is restricted to ADMIN and PTS_OFFICER
 */
const auditAccessRoles = [UserRole.ADMIN, UserRole.PTS_OFFICER];

// Get available event types for filtering
router.get('/event-types', restrictTo(...auditAccessRoles), auditController.getEventTypes);

// Get audit summary
router.get('/summary', restrictTo(...auditAccessRoles), auditController.getSummary);

// Search audit events
router.get('/events', restrictTo(...auditAccessRoles), auditController.searchEvents);

// Export audit events
router.get('/export', restrictTo(...auditAccessRoles), auditController.exportEvents);

// Get audit trail for a specific entity
router.get(
  '/entity/:entityType/:entityId',
  restrictTo(...auditAccessRoles),
  auditController.getEntityAuditTrail,
);

export default router;

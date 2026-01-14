/**
 * PHTS System - Delegation Routes
 *
 * API routes for delegation operations.
 */

import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/authMiddleware.js';
import { UserRole } from '../../types/auth.js';
import * as delegationController from './delegation.controller.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

// Get delegations for current user (any authenticated user)
router.get('/my', delegationController.getMyDelegations);

// Get active acting roles for current user
router.get('/acting', delegationController.getActingRoles);

// Check if can act as a role
router.get('/check/:role', delegationController.checkCanAct);

// Create a new delegation (approver roles only)
router.post(
  '/',
  restrictTo(
    UserRole.HEAD_WARD,
    UserRole.HEAD_DEPT,
    UserRole.PTS_OFFICER,
    UserRole.HEAD_HR,
    UserRole.HEAD_FINANCE,
    UserRole.DIRECTOR,
    UserRole.ADMIN,
  ),
  delegationController.createDelegation,
);

// Cancel a delegation (delegator, delegate, or admin)
router.delete('/:id', delegationController.cancelDelegation);

// Admin only routes
router.get('/all', restrictTo(UserRole.ADMIN), delegationController.getAllDelegations);
router.post('/expire', restrictTo(UserRole.ADMIN), delegationController.expireDelegations);

export default router;

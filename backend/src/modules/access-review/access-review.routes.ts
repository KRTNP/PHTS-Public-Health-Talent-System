/**
 * PHTS System - Access Review Routes
 *
 * API routes for access review operations.
 * Access restricted to ADMIN only (per FR-08-01)
 */

import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/authMiddleware.js';
import { UserRole } from '../../types/auth.js';
import * as accessReviewController from './access-review.controller.js';

const router = Router();

/**
 * All routes require authentication and ADMIN role
 */
router.use(protect);
router.use(restrictTo(UserRole.ADMIN));

// Get all review cycles
router.get('/cycles', accessReviewController.getCycles);

// Create new review cycle
router.post('/cycles', accessReviewController.createCycle);

// Get a specific review cycle
router.get('/cycles/:id', accessReviewController.getCycle);

// Get review items for a cycle
router.get('/cycles/:id/items', accessReviewController.getItems);

// Complete a review cycle
router.post('/cycles/:id/complete', accessReviewController.completeCycle);

// Update review result for a user
router.put('/items/:id', accessReviewController.updateItem);

// Manual trigger for auto-disable job
router.post('/auto-disable', accessReviewController.runAutoDisable);

// Send review reminders
router.post('/send-reminders', accessReviewController.sendReminders);

export default router;

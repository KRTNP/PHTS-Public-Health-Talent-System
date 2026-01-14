/**
 * PHTS System - Data Quality Routes
 *
 * API routes for data quality operations.
 */

import { Router } from 'express';
import { protect, restrictTo } from '../../middlewares/authMiddleware.js';
import { UserRole } from '../../types/auth.js';
import * as dataQualityController from './data-quality.controller.js';

const router = Router();

/**
 * All routes require authentication
 */
router.use(protect);

// Roles that can view data quality
const viewRoles = [UserRole.PTS_OFFICER, UserRole.HEAD_HR, UserRole.ADMIN];

// Get dashboard
router.get('/dashboard', restrictTo(...viewRoles), dataQualityController.getDashboard);

// Get summary
router.get('/summary', restrictTo(...viewRoles), dataQualityController.getSummary);

// Get issue types
router.get('/types', restrictTo(...viewRoles), dataQualityController.getIssueTypes);

// Get issues with filters
router.get('/issues', restrictTo(...viewRoles), dataQualityController.getIssues);

// Create a new issue (report)
router.post('/issues', restrictTo(...viewRoles), dataQualityController.createIssue);

// Update issue status
router.put('/issues/:id', restrictTo(...viewRoles), dataQualityController.updateIssue);

// Admin only: run checks and auto-resolve
router.post('/run-checks', restrictTo(UserRole.ADMIN), dataQualityController.runChecks);
router.post('/auto-resolve', restrictTo(UserRole.ADMIN), dataQualityController.autoResolve);

export default router;

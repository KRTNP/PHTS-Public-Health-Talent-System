/**
 * PHTS System - Authentication Routes
 *
 * Defines API endpoints for authentication operations
 *
 * Date: 2025-12-30
 */

import { Router } from "express";
import * as authController from "@/modules/auth/api/auth.controller.js";
import { optionalAuth, protect } from "@middlewares/authMiddleware.js";
import {
  authProbeRateLimiter,
  authLogoutRateLimiter,
  authRateLimiter,
} from "@middlewares/rateLimiter.js";
import { validate } from "@shared/validate.middleware.js";
import {
  loginSchema,
  updateProfileSchema,
} from "@/modules/auth/auth.schema.js";

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and set HttpOnly JWT cookie
 * @access  Public
 * @body    { citizen_id: string, password: string }
 * @returns { success: boolean, user: UserProfile }
 */
router.post(
  "/login",
  authRateLimiter,
  validate(loginSchema),
  authController.login,
);

// Throttle repeated invalid/expired token probes on current-user endpoints.
router.use("/me", authProbeRateLimiter);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user's profile
 * @access  Protected
 * @returns { success: boolean, data: UserProfile }
 */
router.get("/me", protect, authController.getCurrentUser);

/**
 * @route   PATCH /api/auth/me
 * @desc    Update current authenticated user's profile fields
 * @access  Protected
 */
router.patch(
  "/me",
  protect,
  validate(updateProfileSchema),
  authController.updateCurrentUser,
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Optional auth
 * @returns { success: boolean, message: string }
 */
router.post(
  "/logout",
  authLogoutRateLimiter,
  optionalAuth,
  authController.logout,
);

export default router;

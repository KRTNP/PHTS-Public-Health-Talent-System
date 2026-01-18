/**
 * Error Handler Middleware
 *
 * Centralized error handling with standardized responses
 */

import type { NextFunction, Request, Response } from 'express';
import { AppError, buildErrorResponse, isOperationalError } from '../utils/errors.js';

/**
 * Handle 404 Not Found routes
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`,
    },
  });
};

/**
 * Global error handler middleware
 * Must be registered last in Express middleware chain
 */
export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log error
  const isOperational = isOperationalError(err);

  if (!isOperational) {
    // Programming error - log full stack
    console.error('[ERROR] Unexpected error:', err.stack || err);
  } else if (process.env.NODE_ENV !== 'production') {
    // Operational error in development - log for debugging
    console.error('[ERROR]', err.message);
  }

  // Determine status code
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  // Build standardized response
  const errorResponse = buildErrorResponse(err);

  res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper for route handlers
 * Automatically catches async errors and forwards to error handler
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getAll();
 *   res.json({ success: true, data: users });
 * }));
 */
export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>
) => {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler for express-validator
 */
export const handleValidationErrors = (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  // If using express-validator, check for validation errors here
  // For now, just pass through
  next();
};

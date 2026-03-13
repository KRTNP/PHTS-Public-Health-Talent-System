/**
 * Input Validation Middleware
 *
 * Validates request body field lengths to prevent DoS attacks
 * and database field overflow issues
 */

import { Request, Response, NextFunction } from "express";
import {
  FIELD_LIMITS,
  sanitizeObject,
  validateLength,
} from "@shared/utils/inputValidator.js";

/**
 * Validate input field lengths
 * Prevents extremely large strings from causing performance issues
 */
export const inputValidationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Skip GET/HEAD/DELETE requests (no body)
  if (["GET", "HEAD", "DELETE", "OPTIONS"].includes(req.method)) {
    return next();
  }

  try {
    // Validate request body exists
    if (!req.body || typeof req.body !== "object") {
      return next();
    }

    // Validate field lengths for common fields
    validateCommonFields(req.body);

    // Sanitize string inputs
    req.body = sanitizeObject(req.body);

    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Input validation failed: ${(error as Error).message}`,
      },
    });
  }
};

/**
 * Validate common fields that appear in most requests
 */
function validateCommonFields(body: Record<string, any>): void {
  const errors: string[] = [];
  const commonFieldLimits: Array<{
    key: string;
    limit: number;
  }> = [
    { key: "citizen_id", limit: FIELD_LIMITS.CITIZEN_ID },
    { key: "password", limit: FIELD_LIMITS.PASSWORD },
    { key: "comment", limit: FIELD_LIMITS.COMMENT },
    { key: "reason", limit: FIELD_LIMITS.REJECTION_REASON },
    { key: "name", limit: FIELD_LIMITS.NAME },
    { key: "email", limit: FIELD_LIMITS.EMAIL },
    { key: "description", limit: FIELD_LIMITS.DESCRIPTION },
  ];

  const validateField = (fieldName: string, maxLength: number) => {
    const value = body[fieldName];
    if (!value) return;
    try {
      validateLength(value, fieldName, maxLength);
    } catch (e) {
      errors.push((e as Error).message);
    }
  };
  for (const field of commonFieldLimits) {
    validateField(field.key, field.limit);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}

/**
 * Validate specific field length
 * Can be used in route handlers for custom validation
 */
export function validateFieldLength(
  value: any,
  fieldName: string,
  maxLength: number,
): void {
  if (typeof value === "string" && value.length > maxLength) {
    throw new Error(
      `${fieldName} exceeds maximum length of ${maxLength} characters`,
    );
  }
}

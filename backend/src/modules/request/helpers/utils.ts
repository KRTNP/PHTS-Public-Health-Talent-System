/**
 * Request Module Utilities
 *
 * Helper functions for controller logic
 */

import { Request } from "express";
import path from "node:path";
import fs from "node:fs";

export type StatusRule = Readonly<{
  matches: (message: string) => boolean;
  code: number;
}>;

export const resolveStatusCode = (
  message: string | undefined,
  rules: StatusRule[],
  defaultCode = 500,
): number => {
  if (!message) return defaultCode;
  // Sanitize message to prevent ReDoS: truncate to reasonable length and escape special chars
  const sanitizedMessage = message
    .slice(0, 500)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const rule of rules) {
    if (rule.matches(sanitizedMessage)) return rule.code;
  }
  return defaultCode;
};

export const parseJsonField = <T>(
  value: unknown,
  fieldName: string,
): T | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch (_error) {
      throw new Error(`Invalid ${fieldName} format. Must be valid JSON.`);
    }
  }
  return value as T;
};

export const parseRequestedAmount = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

export function normalizeScopeParam(scope: unknown): string | undefined {
  if (typeof scope !== "string") return undefined;
  const trimmed = scope.trim();
  if (!trimmed || trimmed.length > 120) return undefined;
  if (!/^[\p{L}\p{N}\s._\-()/]+$/u.test(trimmed)) return undefined;
  return trimmed;
}

export const DOCUMENT_UPLOAD_ROOT = path.join(
  process.cwd(),
  "uploads/documents",
);
export const UPLOAD_SESSION_REGEX = /^[a-f0-9-]{36}$/i;

export function cleanupUploadSession(req: Request): void {
  const sessionId = (req as any).uploadSessionId; // Type assertion since it might be extended
  if (!sessionId || !UPLOAD_SESSION_REGEX.test(sessionId)) return;

  const resolvedRoot = path.resolve(DOCUMENT_UPLOAD_ROOT);
  const resolvedTarget = path.resolve(
    path.join(DOCUMENT_UPLOAD_ROOT, sessionId),
  );

  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    return;
  }

  try {
    fs.rmSync(resolvedTarget, { recursive: true, force: true });
  } catch (error) {
    console.error("Error cleaning up upload session:", error);
  }
}

import { Request, Response, NextFunction } from "express";
import { hasAuthCookieToken } from "@shared/utils/authToken.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type CsrfProtectionOptions = {
  isOriginAllowed: (origin: string) => boolean;
  isTrustedNoOriginClient?: (req: Request) => boolean;
};

const getHeaderValue = (
  value: string | string[] | undefined,
): string | null => {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  if (typeof value === "string") return value.trim() || null;
  return null;
};

export function createCsrfProtection(options: CsrfProtectionOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!UNSAFE_METHODS.has(req.method.toUpperCase())) {
      next();
      return;
    }

    // Enforce CSRF checks only when auth comes from browser cookie.
    // Non-browser/API clients that use Authorization: Bearer remain unaffected.
    if (!hasAuthCookieToken(req)) {
      next();
      return;
    }

    const origin = getHeaderValue(req.headers.origin);
    if (!origin) {
      if (options.isTrustedNoOriginClient?.(req)) {
        next();
        return;
      }
      res.status(403).json({
        success: false,
        error: {
          code: "CSRF_ORIGIN_REQUIRED",
          message: "Origin header is required for cookie-authenticated requests",
        },
      });
      return;
    }

    if (!options.isOriginAllowed(origin)) {
      res.status(403).json({
        success: false,
        error: {
          code: "CSRF_ORIGIN_FORBIDDEN",
          message: "Cross-site request blocked",
        },
      });
      return;
    }

    const secFetchSite = getHeaderValue(req.headers["sec-fetch-site"]);
    if (secFetchSite === "cross-site") {
      res.status(403).json({
        success: false,
        error: {
          code: "CSRF_FETCH_SITE_FORBIDDEN",
          message: "Cross-site request blocked",
        },
      });
      return;
    }

    next();
  };
}

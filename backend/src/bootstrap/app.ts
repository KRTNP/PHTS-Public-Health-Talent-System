import express, { Application } from "express";
import crypto from "node:crypto";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { initializePassport } from "@config/passport.js";
import authRoutes from "@/modules/auth/api/auth.route.js";
import requestRoutes from "@/modules/request/api/request.route.js";
import signatureRoutes from "@/modules/signature/api/signature.route.js";
import payrollRoutes from "@/modules/payroll/api/payroll.route.js";
import reportRoutes from "@/modules/report/report.routes.js";
import systemRoutes from "@/modules/system/admin/api/admin.route.js";
import masterDataRoutes from "@/modules/master-data/api/master-data.route.js";
import leaveManagementRoutes from "@/modules/leave-management/api/leave-management.route.js";
import notificationRoutes from "@/modules/notification/api/notification.route.js";
import financeRoutes from "@/modules/finance/finance.routes.js";
import auditRoutes from "@/modules/audit/api/audit.route.js";
import slaRoutes from "@/modules/sla/sla.routes.js";
import accessReviewRoutes from "@/modules/access-review/api/access-review.route.js";
import snapshotRoutes from "@/modules/snapshot/snapshot.routes.js";
import personnelChangesRoutes from "@/modules/workforce-compliance/routes/personnel-changes.routes.js";
import licenseComplianceRoutes from "@/modules/workforce-compliance/routes/license-compliance.routes.js";
import healthRoutes from "@/modules/health/api/health.route.js";
import announcementRoutes from "@/modules/announcement/api/announcement.route.js";
import supportRoutes from "@/modules/support/api/support.route.js";
import dashboardRoutes from "@/modules/dashboard/routes/dashboard.routes.js";
import navigationRoutes from "@/modules/navigation/api/navigation.route.js";
import { isMaintenanceModeEnabled } from "@/modules/system/services/maintenance.service.js";
import { errorHandler, notFoundHandler } from "@middlewares/errorHandler.js";
import { apiRateLimiter, securityRateLimiter } from "@middlewares/rateLimiter.js";
import { protect } from "@middlewares/authMiddleware.js";
import { createCsrfProtection } from "@middlewares/csrfProtection.js";
import { tokenBlacklistMiddleware } from "@middlewares/tokenBlacklistMiddleware.js";
import { authorizeUploadAccess } from "@middlewares/uploadAccessMiddleware.js";
import { sanitizeUrlForLogs } from "@shared/utils/log-sanitizer.js";

export const createConfiguredApp = (nodeEnv: string): Application => {
  const app: Application = express();
  app.disable("x-powered-by");

  const trustProxyRaw = String(process.env.TRUST_PROXY || "").trim();
  if (trustProxyRaw) {
    if (trustProxyRaw.toLowerCase() === "true") {
      app.set("trust proxy", true);
    } else if (trustProxyRaw.toLowerCase() === "false") {
      app.set("trust proxy", false);
    } else if (/^\d+$/.test(trustProxyRaw)) {
      app.set("trust proxy", Number(trustProxyRaw));
    } else {
      app.set("trust proxy", trustProxyRaw);
    }
  }

  const envOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = [...new Set(envOrigins)];
  const defaultTunnelSuffixes = [".trycloudflare.com"];
  const devTunnelAllowedSuffixes = (
    process.env.CORS_DEV_TUNNEL_SUFFIXES || defaultTunnelSuffixes.join(",")
  )
    .split(",")
    .map((suffix) => suffix.trim().toLowerCase())
    .filter(Boolean)
    .map((suffix) => (suffix.startsWith(".") ? suffix : `.${suffix}`));
  const preflightAllowedPathRules = (
    process.env.CORS_PREFLIGHT_ALLOWED_PATHS || "/api/auth/login"
  )
    .split(",")
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const [rawPath = "", rawMethods = ""] = rule.split(":");
      const pathRule = rawPath.trim();
      if (!pathRule) return null;

      const isPrefix = pathRule.endsWith("*");
      const path = isPrefix ? pathRule.slice(0, -1) : pathRule;
      const methods = rawMethods
        .split("|")
        .map((method) => method.trim().toUpperCase())
        .filter(Boolean);

      return {
        isPrefix,
        path,
        methods: methods.length > 0 ? new Set(methods) : null,
      };
    })
    .filter((rule): rule is { isPrefix: boolean; path: string; methods: Set<string> | null } => Boolean(rule));
  const csrfTrustedClientHeader = String(
    process.env.CSRF_TRUSTED_CLIENT_HEADER || "x-client-id",
  )
    .trim()
    .toLowerCase();
  const csrfTrustedClientIds = (
    process.env.CSRF_TRUSTED_CLIENT_IDS || ""
  )
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const isOriginAllowed = (origin: string): boolean => {
    const normalizedOrigin = origin.trim();
    if (!normalizedOrigin) return true;

    let originUrl: URL;
    try {
      originUrl = new URL(normalizedOrigin);
    } catch {
      return false;
    }

    if (nodeEnv !== "production") {
      if (
        devTunnelAllowedSuffixes.some((suffix) =>
          originUrl.hostname.toLowerCase().endsWith(suffix),
        )
      ) {
        return true;
      }
    }

    return allowedOrigins.some((allowed) => {
      const rule = allowed.trim();
      if (!rule) return false;

      if (rule === normalizedOrigin || normalizedOrigin.startsWith(`${rule}/`)) {
        return true;
      }

      if (rule.startsWith("*.")) {
        const domain = rule.slice(2);
        return (
          originUrl.hostname === domain ||
          originUrl.hostname.endsWith(`.${domain}`)
        );
      }

      try {
        const allowedUrl = new URL(rule);
        return (
          allowedUrl.protocol === originUrl.protocol &&
          allowedUrl.hostname === originUrl.hostname &&
          allowedUrl.port === originUrl.port
        );
      } catch {
        return false;
      }
    });
  };

  const isPreflightPathAllowed = (
    pathname: string,
    requestedMethod: string,
  ): boolean =>
    preflightAllowedPathRules.some((rule) => {
      const pathMatch = rule.isPrefix
        ? pathname.startsWith(rule.path)
        : pathname === rule.path;

      if (!pathMatch) {
        return false;
      }

      if (!rule.methods) {
        return true;
      }

      return rule.methods.has(requestedMethod.toUpperCase());
    });

  const frameAncestorsDirectives =
    nodeEnv === "production" ? ["'self'"] : ["'self'", ...allowedOrigins];

  app.use(
    helmet({
      frameguard: { action: "sameorigin" },
      crossOriginEmbedderPolicy: true,
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          frameAncestors: frameAncestorsDirectives,
        },
      },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        const isAllowed = !origin || isOriginAllowed(origin);

        if (isAllowed) {
          return callback(null, true);
        }

        console.warn(`[CORS] Blocked origin: ${origin}`);
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      preflightContinue: true,
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Cache-Control",
        "Pragma",
        "If-Modified-Since",
        "If-None-Match",
        "X-Requested-With",
        "X-Request-Id",
      ],
    }),
  );

  app.use((req, res, next) => {
    const originHeader = req.headers.origin;
    const origin =
      typeof originHeader === "string" ? originHeader : Array.isArray(originHeader) ? originHeader[0] : "";

    if (origin && !isOriginAllowed(origin)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "CORS_ORIGIN_FORBIDDEN",
          message: "Origin is not allowed",
        },
      });
    }

    return next();
  });

  app.use((req, res, next) => {
    if (req.method !== "OPTIONS") return next();

    const originHeader = req.headers.origin;
    const origin =
      typeof originHeader === "string"
        ? originHeader
        : Array.isArray(originHeader)
          ? originHeader[0]
          : "";

    if (!origin || !isOriginAllowed(origin)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "CORS_ORIGIN_FORBIDDEN",
          message: "Origin is not allowed",
        },
      });
    }

    const accessControlRequestMethodHeader =
      req.headers["access-control-request-method"];
    const accessControlRequestMethod =
      typeof accessControlRequestMethodHeader === "string"
        ? accessControlRequestMethodHeader
        : Array.isArray(accessControlRequestMethodHeader)
          ? accessControlRequestMethodHeader[0]
          : "";

    if (!accessControlRequestMethod.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Invalid CORS preflight request",
        },
      });
    }

    if (!isPreflightPathAllowed(req.path, accessControlRequestMethod)) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบเส้นทางที่ร้องขอ",
        },
      });
    }

    return res.status(204).end();
  });

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.use((req, res, next) => {
    const cacheablePublicPaths = new Set(["/sitemap.xml"]);
    if (!req.path.startsWith("/uploads") && !cacheablePublicPaths.has(req.path)) {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  });

  app.use((req, res, next) => {
    const incomingId = req.headers["x-request-id"];
    const requestId =
      typeof incomingId === "string" && incomingId.trim()
        ? incomingId
        : crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });

  morgan.token("sanitized-url", (req) => sanitizeUrlForLogs(req.url || "/"));
  const morganFormat =
    nodeEnv === "production"
      ? ':remote-addr :method :sanitized-url :status :res[content-length] - :response-time ms'
      : ":method :sanitized-url :status :response-time ms";
  app.use(morgan(morganFormat));

  app.use(initializePassport());

  app.use(
    "/uploads",
    securityRateLimiter,
    tokenBlacklistMiddleware,
    protect,
    authorizeUploadAccess,
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(path.join(process.cwd(), "uploads")),
  );

  app.use("/", healthRoutes);

  app.use(securityRateLimiter, async (req, res, next) => {
    const maintenanceEnabled = await isMaintenanceModeEnabled();
    if (!maintenanceEnabled) return next();

    const allowPaths = [
      "/health",
      "/ready",
      "/api/system/maintenance",
      "/api/auth/login",
    ];
    if (allowPaths.some((allowPath) => req.path.startsWith(allowPath))) {
      return next();
    }

    return res.status(503).json({
      success: false,
      error: "MAINTENANCE_MODE",
      message: "Service is temporarily unavailable due to maintenance",
    });
  });

  app.use("/api", apiRateLimiter, tokenBlacklistMiddleware);
  app.use(
    "/api",
    createCsrfProtection({
      isOriginAllowed,
      isTrustedNoOriginClient: (req) => {
        if (!csrfTrustedClientHeader || csrfTrustedClientIds.length === 0) {
          return false;
        }
        const headerValueRaw = req.headers[csrfTrustedClientHeader];
        const headerValue =
          typeof headerValueRaw === "string"
            ? headerValueRaw.trim()
            : Array.isArray(headerValueRaw)
              ? String(headerValueRaw[0] ?? "").trim()
              : "";
        return (
          Boolean(headerValue) &&
          csrfTrustedClientIds.includes(headerValue)
        );
      },
    }),
  );
  app.use("/api/auth", authRoutes);
  app.use("/api/requests", requestRoutes);
  app.use("/api/signatures", signatureRoutes);
  app.use("/api/payroll", payrollRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/system", systemRoutes);
  app.use("/api/config", masterDataRoutes);
  app.use("/api/leave-management", leaveManagementRoutes);
  // Backward-compatible alias for legacy frontend clients.
  app.use("/api/leave-records", leaveManagementRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/finance", financeRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/sla", slaRoutes);
  app.use("/api/access-review", accessReviewRoutes);
  app.use("/api/snapshots", snapshotRoutes);
  app.use("/api/personnel-changes", personnelChangesRoutes);
  app.use("/api/license-compliance", licenseComplianceRoutes);
  app.use("/api/announcements", announcementRoutes);
  app.use("/api/support", supportRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/navigation", navigationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

import express, { Application } from "express";
import crypto from "node:crypto";
import path from "node:path";
import jwt from "jsonwebtoken";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { initializePassport } from "@config/passport.js";
import { getJwtSecret } from "@config/jwt.js";
import authRoutes from "@/modules/auth/auth.routes.js";
import requestRoutes from "@/modules/request/api/request.route.js";
import signatureRoutes from "@/modules/signature/signature.routes.js";
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
import { apiRateLimiter } from "@middlewares/rateLimiter.js";
import { protect } from "@middlewares/authMiddleware.js";
import { tokenBlacklistMiddleware } from "@middlewares/tokenBlacklistMiddleware.js";
import { authorizeUploadAccess } from "@middlewares/uploadAccessMiddleware.js";

export const createConfiguredApp = (nodeEnv: string): Application => {
  const app: Application = express();

  const envOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultOrigins = ["http://localhost:3000"];
  const allowedOrigins = [...new Set([...envOrigins, ...defaultOrigins])];
  const defaultTunnelSuffixes = [".trycloudflare.com"];
  const devTunnelAllowedSuffixes = (
    process.env.CORS_DEV_TUNNEL_SUFFIXES || defaultTunnelSuffixes.join(",")
  )
    .split(",")
    .map((suffix) => suffix.trim().toLowerCase())
    .filter(Boolean)
    .map((suffix) => (suffix.startsWith(".") ? suffix : `.${suffix}`));

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

  app.use(
    helmet({
      frameguard: false,
      crossOriginEmbedderPolicy: true,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          frameAncestors: ["'self'", ...allowedOrigins],
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
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

  if (nodeEnv === "production") {
    app.use(morgan("combined"));
  } else {
    app.use(morgan("dev"));
  }

  app.use(initializePassport());

  app.use(
    "/uploads",
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

  app.use(async (req, res, next) => {
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

    const authHeader = req.headers.authorization;
    const token =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length)
        : null;

    if (token) {
      try {
        const jwtSecret = getJwtSecret();
        const payload = jwt.verify(token, jwtSecret) as { role?: string };
        if (payload?.role === "ADMIN") {
          return next();
        }
      } catch {
        // Ignore invalid token and continue to maintenance response
      }
    }

    return res.status(503).json({
      success: false,
      error: "MAINTENANCE_MODE",
      message: "Service is temporarily unavailable due to maintenance",
    });
  });

  app.use("/api", tokenBlacklistMiddleware, apiRateLimiter);
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

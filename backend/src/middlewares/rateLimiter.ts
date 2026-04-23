import rateLimit from "express-rate-limit";
import {
  getNodeEnv,
  getRateLimitConfig,
  isTestEnv,
} from "@config/runtime-config.js";

const isDevelopment = () => getNodeEnv() === "development";

const firstHeaderValue = (
  value: string | string[] | undefined,
): string | null => {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  if (typeof value === "string") return value.trim() || null;
  return null;
};

const getClientKey = (req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}) => {
  const allowForwarded = getRateLimitConfig().trustProxyHeaders;
  if (allowForwarded) {
    const cfIp = firstHeaderValue(req.headers?.["cf-connecting-ip"]);
    if (cfIp) return `ip:${cfIp}`;

    const realIp = firstHeaderValue(req.headers?.["x-real-ip"]);
    if (realIp) return `ip:${realIp}`;

    const forwarded = firstHeaderValue(req.headers?.["x-forwarded-for"]);
    const forwardedIp = forwarded?.split(",")[0]?.trim();
    if (forwardedIp) return `ip:${forwardedIp}`;
  }

  const ip = (req.ip || "").trim();
  return `ip:${ip || "unknown"}`;
};

const shouldSkipRateLimitInDevelopment = () =>
  isDevelopment() && !getRateLimitConfig().devEnabled;

type RateLimitedRequest = {
  rateLimit?: {
    resetTime?: Date;
  };
};

export const apiRateLimiter = rateLimit({
  windowMs: getRateLimitConfig().windowMs,
  max: getRateLimitConfig().max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientKey(req),
  skip: (req) =>
    isTestEnv() ||
    shouldSkipRateLimitInDevelopment() ||
    String(req.path ?? "").startsWith("/auth"),
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
});

export const authRateLimiter = rateLimit({
  windowMs: getRateLimitConfig().authWindowMs,
  max: getRateLimitConfig().authMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientKey(req),
  skip: () => isTestEnv(),
  handler: (req, res) => {
    const requestWithRateLimit = req as typeof req & RateLimitedRequest;
    const now = Date.now();
    const resetTime =
      requestWithRateLimit.rateLimit?.resetTime instanceof Date
        ? requestWithRateLimit.rateLimit.resetTime.getTime()
        : now + getRateLimitConfig().authWindowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
    const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      error: "Too many login attempts, please try again later.",
      message: `Too many login attempts. Please try again in about ${retryAfterMinutes} minute(s).`,
      retry_after_seconds: retryAfterSeconds,
      retry_after_minutes: retryAfterMinutes,
    });
  },
});

export const securityRateLimiter = rateLimit({
  windowMs: getRateLimitConfig().securityWindowMs,
  max: getRateLimitConfig().securityMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientKey(req),
  skip: () =>
    isTestEnv() || shouldSkipRateLimitInDevelopment(),
  message: {
    success: false,
    error: "Too many requests, please try again later.",
  },
});

export const authProbeRateLimiter = rateLimit({
  windowMs: getRateLimitConfig().authProbeWindowMs,
  max: getRateLimitConfig().authProbeMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientKey(req),
  skip: () => isTestEnv(),
  handler: (req, res) => {
    const requestWithRateLimit = req as typeof req & RateLimitedRequest;
    const now = Date.now();
    const resetTime =
      requestWithRateLimit.rateLimit?.resetTime instanceof Date
        ? requestWithRateLimit.rateLimit.resetTime.getTime()
        : now + getRateLimitConfig().authProbeWindowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      success: false,
      code: "AUTH_PROBE_RATE_LIMIT_EXCEEDED",
      error: "Too many authentication attempts, please try again later.",
      retry_after_seconds: retryAfterSeconds,
    });
  },
});

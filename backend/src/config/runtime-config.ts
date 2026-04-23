import type jwt from "jsonwebtoken";

const DEFAULT_APP_TIMEZONE = "Asia/Bangkok";
const DEFAULT_DB_TIMEZONE_OFFSET = "+07:00";
const DEFAULT_PORT = 3001;

const DEFAULT_NOTIFICATION_OUTBOX_MAX_ATTEMPTS = 8;
const DEFAULT_NOTIFICATION_OUTBOX_RETRY_BASE_SECONDS = 30;
const DEFAULT_NOTIFICATION_OUTBOX_RETRY_MAX_SECONDS = 1800;
const DEFAULT_NOTIFICATION_OUTBOX_PROCESSING_TIMEOUT_SECONDS = 300;
const DEFAULT_NOTIFICATION_OUTBOX_WORKER_POLL_MS = 5000;
const DEFAULT_NOTIFICATION_OUTBOX_WORKER_BATCH_LIMIT = 100;

const DEFAULT_SNAPSHOT_OUTBOX_MAX_ATTEMPTS = 8;
const DEFAULT_SNAPSHOT_OUTBOX_RETRY_BASE_SECONDS = 30;
const DEFAULT_SNAPSHOT_OUTBOX_RETRY_MAX_SECONDS = 1800;
const DEFAULT_SNAPSHOT_OUTBOX_PROCESSING_TIMEOUT_SECONDS = 300;
const DEFAULT_SNAPSHOT_WORKER_POLL_MS = 5000;
const DEFAULT_SNAPSHOT_WORKER_BATCH_LIMIT = 20;

const DEFAULT_BACKUP_WORKER_POLL_MS = 30000;
const DEFAULT_OCR_STALE_PROCESSING_MINUTES = 30;

const DEFAULT_SIGNATURE_REFRESH_DELAY_MS = 1500;
const DEFAULT_SIGNATURE_REFRESH_COOLDOWN_MS = 5000;

const toSafeInt = (
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
};

export const getNodeEnv = (): string =>
  String(process.env.NODE_ENV || "development").toLowerCase();

export const isProductionEnv = (): boolean => getNodeEnv() === "production";

export const isTestEnv = (): boolean => getNodeEnv() === "test";

export const getRuntimePort = (): number =>
  toSafeInt(process.env.PORT, DEFAULT_PORT, 1, 65535);

export const getStartServerFlag = (): string =>
  String(process.env.START_SERVER || "").toLowerCase();

export const isJestRuntime = (): boolean =>
  typeof process.env.JEST_WORKER_ID !== "undefined";

export const getAppTimezone = (): string => DEFAULT_APP_TIMEZONE;

export const getDbTimezoneOffset = (): string => DEFAULT_DB_TIMEZONE_OFFSET;

export const getOpsJobTimezone = (): string => DEFAULT_APP_TIMEZONE;

export const getBackendBaseUrl = (): string =>
  String(process.env.BACKEND_URL || `http://localhost:${getRuntimePort()}`).trim();

export const getVersionMetadata = (): {
  version: string | null;
  commit: string;
} => ({
  version: String(process.env.npm_package_version || "").trim() || null,
  commit: String(process.env.APP_COMMIT || "unknown").trim() || "unknown",
});

export const getAppVersionInfo = (): {
  version: string;
  commit: string;
  env: string;
} => ({
  version: String(process.env.APP_VERSION || "unknown").trim() || "unknown",
  commit: String(process.env.APP_COMMIT || "unknown").trim() || "unknown",
  env: getNodeEnv(),
});

export const getJwtExpiresIn = (): jwt.SignOptions["expiresIn"] =>
  (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) || "24h";

export const getJwtSecret = (): string => {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
};

export const shouldIncludeLegacyLoginToken = (): boolean =>
  String(process.env.AUTH_LOGIN_INCLUDE_TOKEN || "").toLowerCase() === "true";

export const isCookieAuthTokenEnabled = (): boolean =>
  String(process.env.AUTH_ALLOW_COOKIE_TOKEN || "true").toLowerCase() !== "false";

export const getNotificationOutboxConfig = () => {
  const retryBaseSeconds = toSafeInt(
    process.env.NOTIFICATION_OUTBOX_RETRY_BASE_SECONDS,
    DEFAULT_NOTIFICATION_OUTBOX_RETRY_BASE_SECONDS,
    1,
    3600,
  );

  const retryMaxSecondsRaw = toSafeInt(
    process.env.NOTIFICATION_OUTBOX_RETRY_MAX_SECONDS,
    DEFAULT_NOTIFICATION_OUTBOX_RETRY_MAX_SECONDS,
    1,
    7 * 24 * 3600,
  );

  return {
    maxAttempts: toSafeInt(
      process.env.NOTIFICATION_OUTBOX_MAX_ATTEMPTS,
      DEFAULT_NOTIFICATION_OUTBOX_MAX_ATTEMPTS,
      1,
      100,
    ),
    retryBaseSeconds,
    retryMaxSeconds: Math.max(retryBaseSeconds, retryMaxSecondsRaw),
    processingTimeoutSeconds: toSafeInt(
      process.env.NOTIFICATION_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
      DEFAULT_NOTIFICATION_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
      30,
      24 * 3600,
    ),
  };
};

export const getNotificationOutboxWorkerConfig = () => ({
  enabled: process.env.NOTIFICATION_OUTBOX_WORKER_ENABLED !== "false",
  pollMs: toSafeInt(
    process.env.NOTIFICATION_OUTBOX_WORKER_POLL_MS,
    DEFAULT_NOTIFICATION_OUTBOX_WORKER_POLL_MS,
    250,
    60000,
  ),
  batchLimit: toSafeInt(
    process.env.NOTIFICATION_OUTBOX_WORKER_BATCH_LIMIT,
    DEFAULT_NOTIFICATION_OUTBOX_WORKER_BATCH_LIMIT,
    1,
    200,
  ),
});

export const getSnapshotOutboxConfig = () => {
  const retryBaseSeconds = toSafeInt(
    process.env.SNAPSHOT_OUTBOX_RETRY_BASE_SECONDS,
    DEFAULT_SNAPSHOT_OUTBOX_RETRY_BASE_SECONDS,
    1,
    3600,
  );

  const retryMaxSecondsRaw = toSafeInt(
    process.env.SNAPSHOT_OUTBOX_RETRY_MAX_SECONDS,
    DEFAULT_SNAPSHOT_OUTBOX_RETRY_MAX_SECONDS,
    1,
    7 * 24 * 3600,
  );

  return {
    maxAttempts: toSafeInt(
      process.env.SNAPSHOT_OUTBOX_MAX_ATTEMPTS,
      DEFAULT_SNAPSHOT_OUTBOX_MAX_ATTEMPTS,
      1,
      100,
    ),
    retryBaseSeconds,
    retryMaxSeconds: Math.max(retryBaseSeconds, retryMaxSecondsRaw),
    processingTimeoutSeconds: toSafeInt(
      process.env.SNAPSHOT_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
      DEFAULT_SNAPSHOT_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
      30,
      24 * 3600,
    ),
  };
};

export const getSnapshotWorkerConfig = () => ({
  enabled: process.env.SNAPSHOT_WORKER_ENABLED !== "false",
  pollMs: toSafeInt(
    process.env.SNAPSHOT_WORKER_POLL_MS,
    DEFAULT_SNAPSHOT_WORKER_POLL_MS,
    250,
    60000,
  ),
  batchLimit: toSafeInt(
    process.env.SNAPSHOT_WORKER_BATCH_LIMIT,
    DEFAULT_SNAPSHOT_WORKER_BATCH_LIMIT,
    1,
    200,
  ),
});

export const getBackupWorkerConfig = () => ({
  enabled: process.env.BACKUP_WORKER_ENABLED !== "false",
  pollMs: toSafeInt(
    process.env.BACKUP_WORKER_POLL_MS,
    DEFAULT_BACKUP_WORKER_POLL_MS,
    1000,
    600000,
  ),
});

export const getOcrWorkerConfig = () => ({
  enabled: process.env.OCR_WORKER_ENABLED !== "false",
  staleProcessingMinutes: toSafeInt(
    process.env.OCR_STALE_PROCESSING_MINUTES,
    DEFAULT_OCR_STALE_PROCESSING_MINUTES,
    1,
    7 * 24 * 60,
  ),
});

export const getSignatureRefreshConfig = () => ({
  delayMs: toSafeInt(
    process.env.SIGNATURE_REFRESH_DELAY_MS,
    DEFAULT_SIGNATURE_REFRESH_DELAY_MS,
    200,
    60000,
  ),
  cooldownMs: toSafeInt(
    process.env.SIGNATURE_REFRESH_COOLDOWN_MS,
    DEFAULT_SIGNATURE_REFRESH_COOLDOWN_MS,
    500,
    10 * 60 * 1000,
  ),
});

export const getRateLimitConfig = () => {
  const production = isProductionEnv();
  return {
    windowMs: toSafeInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 1000, 24 * 60 * 60 * 1000),
    max: toSafeInt(
      process.env.RATE_LIMIT_MAX,
      production ? 300 : 1000,
      1,
      100000,
    ),
    authWindowMs: toSafeInt(
      process.env.AUTH_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000,
      1000,
      24 * 60 * 60 * 1000,
    ),
    authMax: toSafeInt(process.env.AUTH_RATE_LIMIT_MAX, 5, 1, 100000),
    securityWindowMs: toSafeInt(
      process.env.SECURITY_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000,
      1000,
      24 * 60 * 60 * 1000,
    ),
    securityMax: toSafeInt(
      process.env.SECURITY_RATE_LIMIT_MAX,
      production ? 300 : 1000,
      1,
      100000,
    ),
    authProbeWindowMs: toSafeInt(
      process.env.AUTH_PROBE_RATE_LIMIT_WINDOW_MS,
      5 * 60 * 1000,
      1000,
      24 * 60 * 60 * 1000,
    ),
    authProbeMax: toSafeInt(
      process.env.AUTH_PROBE_RATE_LIMIT_MAX,
      30,
      1,
      100000,
    ),
    trustProxyHeaders:
      String(process.env.RATE_LIMIT_TRUST_PROXY_HEADERS || "").toLowerCase() ===
      "true",
    devEnabled:
      String(process.env.DEV_ENABLE_RATE_LIMIT || "").toLowerCase() === "true",
  };
};

const parseBoolean = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw == null) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
};

export const getHttpRuntimeConfig = () => {
  const defaultTunnelSuffixes = [".trycloudflare.com"];
  const frontendOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const devTunnelAllowedSuffixes = (
    process.env.CORS_DEV_TUNNEL_SUFFIXES || defaultTunnelSuffixes.join(",")
  )
    .split(",")
    .map((suffix) => suffix.trim().toLowerCase())
    .filter(Boolean)
    .map((suffix) => (suffix.startsWith(".") ? suffix : `.${suffix}`));

  return {
    trustProxyRaw: String(process.env.TRUST_PROXY || "").trim(),
    frontendOrigins,
    devTunnelAllowedSuffixes,
    preflightAllowedPathsRaw: String(
      process.env.CORS_PREFLIGHT_ALLOWED_PATHS || "/api/auth/login",
    ),
    csrfTrustedClientHeader: String(
      process.env.CSRF_TRUSTED_CLIENT_HEADER || "x-client-id",
    )
      .trim()
      .toLowerCase(),
    csrfTrustedClientIds: (process.env.CSRF_TRUSTED_CLIENT_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  };
};

export const getLogConfig = () => ({
  level: String(process.env.LOG_LEVEL || "info").trim().toUpperCase(),
  includeStackInErrorLogs: getNodeEnv() === "development",
});

export const shouldIncludeErrorResponseDetails = (): boolean =>
  String(process.env.ERROR_RESPONSE_INCLUDE_DETAILS || "").toLowerCase() ===
  "true";

export const getBackupRuntimeConfig = () => ({
  enabled: process.env.BACKUP_ENABLED === "true",
  command: String(process.env.BACKUP_COMMAND || ""),
  argsRaw: String(process.env.BACKUP_ARGS || ""),
  workdir: String(process.env.BACKUP_WORKDIR || process.cwd()),
  timeoutMs: toSafeInt(process.env.BACKUP_TIMEOUT_MS, 300000, 1000, 86400000),
});

export const getDatabaseRuntimeConfig = () => ({
  host: String(process.env.DB_HOST || "localhost"),
  port: toSafeInt(process.env.DB_PORT, 3306, 1, 65535),
  user: String(process.env.DB_USER || "root"),
  password: String(process.env.DB_PASSWORD || ""),
  database: String(process.env.DB_NAME || "phts_system"),
});

export const getTestDatabaseOverrides = () => ({
  host: String(process.env.TEST_DB_HOST || "").trim(),
  port: String(process.env.TEST_DB_PORT || "").trim(),
  user: String(process.env.TEST_DB_USER || "").trim(),
  password: process.env.TEST_DB_PASSWORD,
  database: String(process.env.TEST_DB_NAME || "").trim(),
});

export const hasAnyTestDatabaseOverrides = (): boolean => {
  const test = getTestDatabaseOverrides();
  return Boolean(
    test.host || test.port || test.user || test.password || test.database,
  );
};

export const getRedisRuntimeConfig = () => ({
  host: String(process.env.REDIS_HOST || "localhost"),
  port: toSafeInt(process.env.REDIS_PORT, 6379, 1, 65535),
  password: String(process.env.REDIS_PASSWORD || "") || undefined,
  db: toSafeInt(process.env.REDIS_DB, 0, 0, 100),
});

export const getSyncWorkerConfig = () => ({
  enabled: process.env.SYNC_WORKER_ENABLED !== "false",
  pollMs: toSafeInt(process.env.SYNC_WORKER_POLL_MS, 30000, 1000, 600000),
});

const normalizeSyncAutoMode = (raw: string | undefined): "DAILY" | "INTERVAL" =>
  String(raw || "").trim().toUpperCase() === "INTERVAL"
    ? "INTERVAL"
    : "DAILY";

const isValidTimeZone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

const normalizeTimezone = (raw: string | undefined, fallback: string): string => {
  const timezone = String(raw || "").trim();
  if (!timezone) return fallback;
  return isValidTimeZone(timezone) ? timezone : fallback;
};

export const getSyncAutoScheduleDefaults = () => ({
  mode: normalizeSyncAutoMode(process.env.SYNC_AUTO_MODE),
  hour: toSafeInt(process.env.SYNC_AUTO_DAILY_HOUR, 2, 0, 23),
  minute: toSafeInt(process.env.SYNC_AUTO_DAILY_MINUTE, 0, 0, 59),
  intervalMinutes: toSafeInt(process.env.SYNC_AUTO_INTERVAL_MINUTES, 60, 1, 1440),
  timezone: normalizeTimezone(process.env.SYNC_AUTO_TIMEZONE, getOpsJobTimezone()),
});

export const getSyncRetentionConfig = () => ({
  dataIssuesDays: toSafeInt(process.env.SYNC_RETENTION_DATA_ISSUES_DAYS, 180, 0, 3650),
  userAuditsDays: toSafeInt(process.env.SYNC_RETENTION_USER_AUDITS_DAYS, 180, 0, 3650),
  stageRunsDays: toSafeInt(process.env.SYNC_RETENTION_STAGE_RUNS_DAYS, 120, 0, 3650),
  batchesDays: toSafeInt(process.env.SYNC_RETENTION_BATCHES_DAYS, 365, 0, 3650),
});

export const isSyncHistoryArtifactsEnabled = (): boolean =>
  parseBoolean(process.env.SYNC_HISTORY_ARTIFACTS_ENABLED, true);

export const getOcrTesseractConfig = () => {
  const toNumberString = (
    value: string | undefined,
    fallback: string,
    min: number,
    max: number,
  ): string => {
    if (!value) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
    return String(Math.floor(parsed));
  };

  const lang =
    (process.env.OCR_TESSERACT_LANG || "tha+eng").trim() || "tha+eng";
  const thresholdingMethodRaw = process.env.OCR_TESSERACT_THRESHOLDING_METHOD;
  const thresholdingWindowRaw = process.env.OCR_TESSERACT_THRESHOLDING_WINDOW_SIZE;
  const thresholdingKFactorRaw = process.env.OCR_TESSERACT_THRESHOLDING_KFACTOR;

  const thresholdingMethod =
    thresholdingMethodRaw === undefined || thresholdingMethodRaw === ""
      ? null
      : toNumberString(thresholdingMethodRaw, "0", 0, 2);

  const thresholdingWindowSize = (() => {
    if (!thresholdingWindowRaw) return null;
    const parsed = Number(thresholdingWindowRaw);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 5) return null;
    return String(parsed);
  })();

  const thresholdingKFactor = (() => {
    if (!thresholdingKFactorRaw) return null;
    const parsed = Number(thresholdingKFactorRaw);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2) return null;
    return String(parsed);
  })();

  return {
    lang,
    oem: toNumberString(process.env.OCR_TESSERACT_OEM, "1", 0, 3),
    psm: toNumberString(process.env.OCR_TESSERACT_PSM, "11", 0, 13),
    pdfDpi: toNumberString(process.env.OCR_TESSERACT_PDF_DPI, "200", 72, 600),
    threadLimit: toNumberString(process.env.OCR_TESSERACT_THREAD_LIMIT, "1", 1, 16),
    preprocessMode: String(process.env.OCR_TESSERACT_PREPROCESS || "none")
      .trim()
      .toLowerCase(),
    thresholdingMethod,
    thresholdingWindowSize,
    thresholdingKFactor,
  };
};

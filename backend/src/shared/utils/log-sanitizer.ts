const REDACTED_VALUE = "[REDACTED]";
const MASKED_VALUE = "[MASKED]";

const REDACT_QUERY_KEYS = new Set([
  "password",
  "pass",
  "pwd",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "auth",
]);

const MASK_QUERY_KEYS = new Set(["citizenid", "citizen_id"]);

const maskCitizenId = (value: string): string => {
  const raw = value.trim();
  if (!raw) return MASKED_VALUE;
  if (raw.length <= 4) return `${"*".repeat(raw.length)}`;
  const visible = raw.slice(-4);
  return `${"*".repeat(raw.length - 4)}${visible}`;
};

const redactSearchParams = (searchParams: URLSearchParams): URLSearchParams => {
  const sanitized = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    const normalizedKey = key.trim().toLowerCase();
    if (REDACT_QUERY_KEYS.has(normalizedKey)) {
      sanitized.append(key, REDACTED_VALUE);
      continue;
    }
    if (MASK_QUERY_KEYS.has(normalizedKey)) {
      sanitized.append(key, maskCitizenId(value));
      continue;
    }
    sanitized.append(key, value);
  }
  return sanitized;
};

export const sanitizeUrlForLogs = (rawUrl: string): string => {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "/";

  try {
    const target = raw.startsWith("http://") || raw.startsWith("https://")
      ? new URL(raw)
      : new URL(raw, "http://sanitizer.local");

    const sanitizedSearch = redactSearchParams(target.searchParams);
    const sanitizedQuery = sanitizedSearch.toString();
    const normalizedPath = `${target.pathname || "/"}${sanitizedQuery ? `?${sanitizedQuery}` : ""}`;
    return normalizedPath;
  } catch {
    return raw;
  }
};

export const maskIdentifierForLogs = (value: string): string =>
  maskCitizenId(String(value ?? ""));

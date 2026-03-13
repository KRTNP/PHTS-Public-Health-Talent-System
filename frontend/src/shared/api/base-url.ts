const DEFAULT_API_BASE_URL = "http://localhost:3001/api";

export const resolveApiBaseUrl = (rawBase?: string | null): string => {
  const value = String(rawBase ?? "").trim();
  if (!value) return DEFAULT_API_BASE_URL;

  if (/^https?:\/\//i.test(value)) return value;

  if (value.startsWith(":")) {
    return `http://localhost${value}`;
  }

  if (value.startsWith("//")) {
    const protocol =
      typeof window !== "undefined" && window.location?.protocol
        ? window.location.protocol
        : "http:";
    return `${protocol}${value}`;
  }

  if (value.startsWith("/")) {
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost:3000";
    return `${origin}${value}`;
  }

  return `http://${value}`;
};

export const DEFAULT_API_BASE = DEFAULT_API_BASE_URL;

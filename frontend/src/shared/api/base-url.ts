export const DEFAULT_BROWSER_API_BASE = "/api";
export const DEFAULT_BROWSER_UPLOADS_BASE = "/uploads";

const isBrowserRuntime = (): boolean => typeof window !== "undefined";

const isTruthyFlag = (value?: string | null): boolean => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const shouldForceSameOriginApiBase = (rawBase: string): boolean => {
  if (!isBrowserRuntime()) return false;
  if (!/^https?:\/\//i.test(rawBase)) return false;
  return !isTruthyFlag(process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN);
};

export const resolveApiBaseUrl = (rawBase?: string | null): string => {
  const value = String(rawBase ?? "").trim();
  if (!value) return DEFAULT_BROWSER_API_BASE;

  if (shouldForceSameOriginApiBase(value)) return DEFAULT_BROWSER_API_BASE;
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");

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
    return value.replace(/\/+$/, "") || "/";
  }

  return `http://${value}`;
};

export const resolveUploadsBaseUrl = (rawApiBase?: string | null): string => {
  const apiBase = resolveApiBaseUrl(rawApiBase);
  if (apiBase.startsWith("/")) return DEFAULT_BROWSER_UPLOADS_BASE;
  return `${apiBase.replace(/\/api\/?$/, "")}/uploads`;
};

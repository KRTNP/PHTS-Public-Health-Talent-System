export const DEFAULT_BROWSER_API_BASE = "/api";
export const DEFAULT_BROWSER_UPLOADS_BASE = "/uploads";

export const resolveApiBaseUrl = (rawBase?: string | null): string => {
  const value = String(rawBase ?? "").trim();
  if (!value) return DEFAULT_BROWSER_API_BASE;

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

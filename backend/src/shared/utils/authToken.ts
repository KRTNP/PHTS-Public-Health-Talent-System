import type { Request } from "express";

const TOKEN_COOKIE_KEY = "phts_token";
const isCookieTokenEnabled = (): boolean =>
  String(process.env.AUTH_ALLOW_COOKIE_TOKEN || "").toLowerCase() === "true";

function parseCookieValue(rawCookie: string, key: string): string | null {
  const parts = rawCookie.split(";");
  for (const part of parts) {
    const [cookieKeyRaw, ...rest] = part.trim().split("=");
    if (!cookieKeyRaw) continue;
    if (cookieKeyRaw !== key) continue;
    const value = rest.join("=");
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }

  // Cookie-based auth is disabled by default to reduce CSRF attack surface.
  if (!isCookieTokenEnabled()) {
    return null;
  }

  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === "string" && cookieHeader.trim()) {
    const tokenFromCookie = parseCookieValue(cookieHeader, TOKEN_COOKIE_KEY);
    if (tokenFromCookie) return tokenFromCookie;
  }

  return null;
}

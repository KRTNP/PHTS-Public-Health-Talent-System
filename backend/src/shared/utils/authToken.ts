import type { Request } from "express";
import { isCookieAuthTokenEnabled } from "@config/runtime-config.js";

export const TOKEN_COOKIE_KEY = "phts_token";

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

export function hasAuthCookieToken(req: Request): boolean {
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== "string" || !cookieHeader.trim()) {
    return false;
  }
  return Boolean(parseCookieValue(cookieHeader, TOKEN_COOKIE_KEY));
}

export function extractAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token) return token;
  }

  // Cookie-based auth is enabled by default because token is set as HttpOnly.
  if (!isCookieAuthTokenEnabled()) {
    return null;
  }

  if (hasAuthCookieToken(req)) {
    const tokenFromCookie = parseCookieValue(
      String(req.headers.cookie),
      TOKEN_COOKIE_KEY,
    );
    if (tokenFromCookie) {
      return tokenFromCookie;
    }
  }

  return null;
}

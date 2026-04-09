import { afterEach, describe, expect, test } from "@jest/globals";
import type { Request } from "express";
import { extractAuthToken } from "@/shared/utils/authToken.js";

const buildRequest = (headers: Record<string, string | undefined>): Request =>
  ({ headers } as unknown as Request);

describe("extractAuthToken", () => {
  const originalAllowCookie = process.env.AUTH_ALLOW_COOKIE_TOKEN;

  afterEach(() => {
    if (originalAllowCookie === undefined) {
      delete process.env.AUTH_ALLOW_COOKIE_TOKEN;
      return;
    }
    process.env.AUTH_ALLOW_COOKIE_TOKEN = originalAllowCookie;
  });

  test("prefers bearer token from authorization header", () => {
    const req = buildRequest({
      authorization: "Bearer token-from-header",
      cookie: "phts_token=token-from-cookie",
    });

    expect(extractAuthToken(req)).toBe("token-from-header");
  });

  test("does not read cookie token when cookie auth is disabled", () => {
    delete process.env.AUTH_ALLOW_COOKIE_TOKEN;
    const req = buildRequest({
      cookie: "phts_token=cookie-only-token",
    });

    expect(extractAuthToken(req)).toBeNull();
  });

  test("reads cookie token only when explicitly enabled", () => {
    process.env.AUTH_ALLOW_COOKIE_TOKEN = "true";
    const req = buildRequest({
      cookie: "phts_token=cookie-only-token",
    });

    expect(extractAuthToken(req)).toBe("cookie-only-token");
  });
});

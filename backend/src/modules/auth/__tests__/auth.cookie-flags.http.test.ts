import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("@/modules/audit/services/audit.service.js", () => ({
  extractRequestInfo: jest
    .fn()
    .mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "jest-http" }),
}));

jest.mock("@shared/services/tokenBlacklist.js", () => ({
  tokenBlacklist: {
    blacklistToken: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/modules/auth/services/auth.service.js", () => ({
  AuthService: {
    login: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
  },
  AuthenticationError: class AuthenticationError extends Error {},
  AccountDisabledError: class AccountDisabledError extends Error {},
  InvalidCitizenIdError: class InvalidCitizenIdError extends Error {},
}));

import { AuthService } from "@/modules/auth/services/auth.service.js";
import { login, logout } from "@/modules/auth/api/auth.controller.js";

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.post("/api/auth/login", (req, res) => void login(req as never, res as never));
  app.post("/api/auth/logout", logout);
  return app;
};

describe("auth http cookie flags", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test("login sets HttpOnly cookie without Secure in development and does not expose token", async () => {
    process.env.NODE_ENV = "development";
    (AuthService.login as jest.Mock).mockResolvedValue({
      token: "dev-token-123",
      user: { id: 1, citizen_id: "1234567890123", role: "USER", is_active: true },
    });

    const app = buildApp();
    const res = await request(app).post("/api/auth/login").send({
      citizen_id: "1234567890123",
      password: "abc12345",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeUndefined();
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toContain("phts_token=dev-token-123");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("Secure");
  });

  test("login sets HttpOnly+Secure cookie in production", async () => {
    process.env.NODE_ENV = "production";
    (AuthService.login as jest.Mock).mockResolvedValue({
      token: "prod-token-123",
      user: { id: 2, citizen_id: "1234567890123", role: "USER", is_active: true },
    });

    const app = buildApp();
    const res = await request(app).post("/api/auth/login").send({
      citizen_id: "1234567890123",
      password: "abc12345",
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toContain("phts_token=prod-token-123");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
  });

  test("logout clears auth cookie even without authenticated req.user", async () => {
    process.env.NODE_ENV = "production";
    const app = buildApp();

    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(200);
    const setCookie = res.headers["set-cookie"]?.[0] ?? "";
    expect(setCookie).toContain("phts_token=");
    expect(setCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
  });
});

import { describe, expect, jest, test } from "@jest/globals";
import {
  AuthenticationError as HttpAuthenticationError,
  NotFoundError,
} from "@/shared/utils/errors.js";

jest.mock("@/modules/audit/services/audit.service.js", () => ({
  extractRequestInfo: jest
    .fn()
    .mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "jest" }),
}));

jest.mock("@shared/services/tokenBlacklist.js", () => ({
  tokenBlacklist: {
    blacklistToken: jest.fn(),
  },
}));

jest.mock("@/modules/auth/services/auth.service.js", () => ({
  AuthService: {
    login: jest.fn(),
    getUserProfile: jest.fn(),
    updateUserProfile: jest.fn(),
    logout: jest.fn(),
  },
  AuthenticationError: class AuthenticationError extends Error {},
  AccountDisabledError: class AccountDisabledError extends Error {},
  InvalidCitizenIdError: class InvalidCitizenIdError extends Error {},
}));

import { AuthService } from "@/modules/auth/services/auth.service.js";
import {
  getCurrentUser,
  login,
  logout,
  updateCurrentUser,
} from "@/modules/auth/api/auth.controller.js";
import { AuthenticationError as ServiceAuthenticationError } from "@/modules/auth/services/auth.service.js";

describe("auth controller", () => {
  test("login sets httpOnly cookie and does not expose token in body", async () => {
    const req: any = {
      body: { citizen_id: "1234567890123", password: "correct-password" },
      headers: {},
      ip: "127.0.0.1",
    };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
    };

    (AuthService.login as jest.Mock).mockResolvedValue({
      token: "jwt-token-123",
      user: {
        id: 9,
        citizen_id: "1234567890123",
        role: "USER",
        is_active: true,
      },
    });

    await login(req, res);

    expect(res.cookie).toHaveBeenCalledWith(
      "phts_token",
      "jwt-token-123",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: expect.objectContaining({
        id: 9,
        citizen_id: "1234567890123",
      }),
    });
  });

  test("login returns 401 for invalid credentials", async () => {
    const req: any = {
      body: { citizen_id: "1234567890123", password: "wrong-password" },
      headers: {},
      ip: "127.0.0.1",
    };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    (AuthService.login as jest.Mock).mockRejectedValue(
      new ServiceAuthenticationError("Invalid citizen ID or password"),
    );

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid citizen ID or password",
    });
  });

  test("getCurrentUser forwards AuthenticationError when not authenticated", async () => {
    const req: any = { user: undefined };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await getCurrentUser(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(HttpAuthenticationError));
  });

  test("getCurrentUser forwards NotFoundError when user profile missing", async () => {
    const req: any = { user: { userId: 10 } };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    (AuthService.getUserProfile as jest.Mock).mockRejectedValue(
      new Error("User not found"),
    );

    await getCurrentUser(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  test("updateCurrentUser forwards NotFoundError when employee profile missing", async () => {
    const req: any = { user: { userId: 10 }, body: {} };
    const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    (AuthService.updateUserProfile as jest.Mock).mockRejectedValue(
      new Error("Employee profile not found"),
    );

    await updateCurrentUser(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  test("logout clears auth cookie even when request has no authenticated user", async () => {
    const req: any = { headers: {} };
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      clearCookie: jest.fn(),
    };
    const next = jest.fn();

    await logout(req, res, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.clearCookie).toHaveBeenCalledWith(
      "phts_token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

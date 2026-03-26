import { Request } from "express";
import {
  getAuthenticatedUserId,
  getAuthenticatedUserRole,
  requireAuthenticatedUserId,
} from "@/shared/http/authenticated-user.js";

describe("authenticated-user helper", () => {
  it("reads role from authenticated user", () => {
    const req = {
      user: {
        userId: 15,
        citizenId: "1234567890123",
        role: "PTS_OFFICER",
      },
    } as unknown as Request;

    expect(getAuthenticatedUserRole(req)).toBe("PTS_OFFICER");
  });

  it("prefers userId and supports legacy id fallback", () => {
    const reqWithUserId = {
      user: {
        userId: 44,
        citizenId: "1234567890123",
        role: "HEAD_HR",
      },
    } as unknown as Request;
    const reqWithLegacyId = {
      user: {
        id: 99,
        userId: undefined,
        citizenId: "1234567890123",
        role: "HEAD_HR",
      },
    } as unknown as Request;

    expect(getAuthenticatedUserId(reqWithUserId)).toBe(44);
    expect(getAuthenticatedUserId(reqWithLegacyId)).toBe(99);
  });

  it("returns null when user is missing", () => {
    const req = {} as Request;

    expect(getAuthenticatedUserId(req)).toBeUndefined();
    expect(getAuthenticatedUserRole(req)).toBeUndefined();
  });

  it("throws when required user id is missing", () => {
    const req = {} as Request;
    expect(() => requireAuthenticatedUserId(req)).toThrow("Unauthorized");
  });
});

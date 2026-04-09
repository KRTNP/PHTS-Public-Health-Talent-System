import { describe, expect, it } from "vitest";
import {
  hasRequiredRole,
  normalizeRole,
} from "@/shared/auth/role-authorization";

describe("normalizeRole", () => {
  it("normalizes mixed-case role values", () => {
    expect(normalizeRole("admin")).toBe("ADMIN");
    expect(normalizeRole(" head_hr ")).toBe("HEAD_HR");
  });

  it("returns null for empty or invalid role values", () => {
    expect(normalizeRole("")).toBeNull();
    expect(normalizeRole("   ")).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
  });
});

describe("hasRequiredRole", () => {
  it("returns true when role matches exactly", () => {
    expect(hasRequiredRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRequiredRole("head_scope", "HEAD_SCOPE")).toBe(true);
  });

  it("returns false when role does not match", () => {
    expect(hasRequiredRole("USER", "ADMIN")).toBe(false);
    expect(hasRequiredRole(null, "ADMIN")).toBe(false);
  });
});

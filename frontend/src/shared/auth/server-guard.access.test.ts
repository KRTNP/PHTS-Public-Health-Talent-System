import { beforeEach, describe, expect, it, vi } from "vitest";

const cookiesMock = vi.fn();
const redirectMock = vi.fn((target: string) => {
  throw new Error(`REDIRECT:${target}`);
});

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("requireRoleAccess security behavior", () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_INTERNAL_API_PROXY_TARGET;

    cookiesMock.mockResolvedValue({
      get: () => ({ value: "token-123" }),
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { role: "ADMIN" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("does not use request host as backend target when target is not configured", async () => {
    const { requireRoleAccess } = await import("@/shared/auth/server-guard");

    await expect(requireRoleAccess("ADMIN")).rejects.toThrow("REDIRECT:/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses configured internal backend target when provided", async () => {
    process.env.NEXT_INTERNAL_API_PROXY_TARGET = "https://backend.internal";
    const { requireRoleAccess } = await import("@/shared/auth/server-guard");

    await expect(requireRoleAccess("ADMIN")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://backend.internal/api/auth/me",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      }),
    );
  });

  it("uses absolute NEXT_PUBLIC_API_URL when internal target is not set", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://public-api.example.com/api";
    const { requireRoleAccess } = await import("@/shared/auth/server-guard");

    await expect(requireRoleAccess("ADMIN")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public-api.example.com/api/auth/me",
      expect.any(Object),
    );
  });
});

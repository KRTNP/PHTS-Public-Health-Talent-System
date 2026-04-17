import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClearAuthSession = vi.fn();
const mockRedirectToLogin = vi.fn();
const mockResolveApiBaseUrl = vi.fn();

const requestUse = vi.fn();
const responseUse = vi.fn();
const axiosInstance = {
  interceptors: {
    request: { use: requestUse },
    response: { use: responseUse },
  },
};

const mockIsAxiosError = vi.fn((error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError));

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => axiosInstance),
    isAxiosError: mockIsAxiosError,
  },
}));

vi.mock("@/shared/auth/session", () => ({
  clearAuthSession: mockClearAuthSession,
}));

vi.mock("@/shared/auth/redirect-policy", () => ({
  redirectToLogin: mockRedirectToLogin,
}));

vi.mock("@/shared/api/base-url", () => ({
  resolveApiBaseUrl: mockResolveApiBaseUrl,
}));

describe("axios auth interceptor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockResolveApiBaseUrl.mockReturnValue("/api");
  });

  it("does not redirect on 401 from /auth/login", async () => {
    await import("@/shared/api/axios");
    const onRejected = responseUse.mock.calls[0][1] as (error: unknown) => Promise<unknown>;

    const error = {
      isAxiosError: true,
      config: { url: "/auth/login" },
      response: { status: 401, data: { success: false, error: "Invalid citizen ID or password" } },
      message: "",
    };

    await expect(onRejected(error)).rejects.toBe(error);
    expect(mockClearAuthSession).not.toHaveBeenCalled();
    expect(mockRedirectToLogin).not.toHaveBeenCalled();
  });

  it("redirects on 401 from protected endpoints", async () => {
    await import("@/shared/api/axios");
    const onRejected = responseUse.mock.calls[0][1] as (error: unknown) => Promise<unknown>;

    const error = {
      isAxiosError: true,
      config: { url: "/auth/me" },
      response: { status: 401, data: { success: false, error: "Unauthorized" } },
      message: "",
    };

    await expect(onRejected(error)).rejects.toBe(error);
    expect(mockClearAuthSession).toHaveBeenCalledTimes(1);
    expect(mockRedirectToLogin).toHaveBeenCalledTimes(1);
  });
});

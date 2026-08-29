import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { AuthProvider } from "@/components/providers/auth-provider";
import {
  AUTH_SESSION_HINT_STORAGE_NAME,
  AUTH_USER_STORAGE_NAME,
} from "@/shared/auth/storage";

const mocked = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  router: {} as { replace: typeof vi.fn; push: typeof vi.fn },
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  pathname: "/login",
  responseUser: {
    id: 999,
    citizen_id: "1000000000999",
    role: "USER",
    first_name: "Default",
    last_name: "User",
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocked.router,
  usePathname: () => mocked.pathname,
}));

vi.mock("@/shared/api/axios", () => ({
  default: {
    get: mocked.apiGet,
    post: mocked.apiPost,
  },
}));

describe("AuthProvider role access guard", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocked.router = { replace: mocked.replace, push: mocked.push };
    localStorage.clear();
    sessionStorage.clear();
    mocked.responseUser = {
      id: 999,
      citizen_id: "1000000000999",
      role: "USER",
      first_name: "Default",
      last_name: "User",
    };
    mocked.apiGet.mockImplementation(async () => ({
      data: {
        success: true,
        data: mocked.responseUser,
      },
    }));
  });

  it("redirects from /login to role home after restoring HEAD_HR session", async () => {
    mocked.pathname = "/login";
    sessionStorage.setItem(AUTH_SESSION_HINT_STORAGE_NAME, "1");
    mocked.responseUser = {
      id: 1,
      citizen_id: "1234567890123",
      role: "HEAD_HR",
      first_name: "Head",
      last_name: "HR",
    };

    render(
      <AuthProvider>
        <div>test</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocked.apiGet).toHaveBeenCalledWith("/auth/me");
    });
    await waitFor(() => {
      expect(mocked.replace).toHaveBeenCalledWith("/head-hr");
    });
  });

  it("does not probe auth on the login page without a session hint", async () => {
    mocked.pathname = "/login";

    render(
      <AuthProvider>
        <div>test</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocked.apiGet).not.toHaveBeenCalled();
    });
    expect(mocked.push).not.toHaveBeenCalled();
  });

  it("redirects when current path does not match user role root", async () => {
    mocked.pathname = "/user/profile";
    mocked.responseUser = {
      id: 2,
      citizen_id: "1234567890124",
      role: "HEAD_FINANCE",
      first_name: "Head",
      last_name: "Finance",
    };

    render(
      <AuthProvider>
        <div>test</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocked.replace).toHaveBeenCalledWith("/head-finance");
    });
  });

  it("does not redirect when user already stays inside role path", async () => {
    mocked.pathname = "/head-finance/reports";
    mocked.responseUser = {
      id: 3,
      citizen_id: "1234567890125",
      role: "HEAD_FINANCE",
      first_name: "Head",
      last_name: "Finance",
    };

    render(
      <AuthProvider>
        <div>test</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocked.apiGet).toHaveBeenCalledWith("/auth/me");
    });
    expect(mocked.replace).not.toHaveBeenCalled();
  });

  it("retains the session hint when initial auth refresh is rate-limited", async () => {
    mocked.pathname = "/user";
    sessionStorage.setItem(AUTH_SESSION_HINT_STORAGE_NAME, "1");
    const error = Object.assign(new Error("Too many requests"), {
      isAxiosError: true,
      response: { status: 429 },
    });
    mocked.apiGet.mockRejectedValueOnce(error);

    render(
      <AuthProvider>
        <div>test</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocked.apiGet).toHaveBeenCalledWith("/auth/me");
    });

    expect(mocked.replace).not.toHaveBeenCalled();
    expect(mocked.apiPost).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(AUTH_SESSION_HINT_STORAGE_NAME)).toBe("1");
  });

  it("does not logout on a transient focus refresh failure", async () => {
    mocked.pathname = "/user";
    sessionStorage.setItem(AUTH_SESSION_HINT_STORAGE_NAME, "1");
    mocked.apiGet
      .mockResolvedValueOnce({
        data: { success: true, data: mocked.responseUser },
      })
      .mockRejectedValueOnce(
        Object.assign(new Error("Temporary server error"), {
          isAxiosError: true,
          response: { status: 500 },
        }),
      );

    render(
      <AuthProvider>
        <div>test</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(mocked.apiGet).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(sessionStorage.getItem(AUTH_USER_STORAGE_NAME)).not.toBeNull();
    });
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(mocked.apiGet.mock.calls.length).toBeGreaterThan(1);
    });

    expect(mocked.apiPost).not.toHaveBeenCalled();
    expect(mocked.replace).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(AUTH_SESSION_HINT_STORAGE_NAME)).toBe("1");
  });
});

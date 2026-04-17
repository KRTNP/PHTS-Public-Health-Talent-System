import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { nextMock, jsonMock, redirectMock } = vi.hoisted(() => ({
  nextMock: vi.fn(() => ({ type: "next" })),
  jsonMock: vi.fn((body: unknown, init?: { status?: number }) => ({
    type: "json",
    status: init?.status ?? 200,
    body,
  })),
  redirectMock: vi.fn((target: URL | { pathname?: string; search?: string }, status?: number) => ({
    type: "redirect",
    status: status ?? 307,
    location:
      target instanceof URL
        ? `${target.pathname}${target.search ?? ""}`
        : `${target.pathname ?? ""}${target.search ?? ""}`,
  })),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextMock,
    json: jsonMock,
    redirect: redirectMock,
  },
}));

import { proxy } from "@/proxy";

const makeRequest = (input: {
  pathname: string;
  host: string;
  forwardedHost?: string;
  query?: string;
}) => {
  const headers = new Headers();
  headers.set("host", input.host);
  if (input.forwardedHost) {
    headers.set("x-forwarded-host", input.forwardedHost);
  }

  const search = input.query ? `?${input.query}` : "";
  const url = new URL(`http://${input.host}${input.pathname}${search}`);

  return {
    nextUrl: {
      pathname: url.pathname,
      host: input.host,
      hostname: input.host.split(":")[0],
      search: url.search,
      searchParams: url.searchParams,
      clone: () => new URL(url.toString()),
    },
    url: url.toString(),
    headers,
  } as unknown;
};

describe("proxy host handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_ALLOW_PUBLIC_DEV", "false");
  });

  it("blocks public development access when NEXT_ALLOW_PUBLIC_DEV is false", () => {
    const request = makeRequest({
      pathname: "/dashboard",
      host: "public.example.com",
    });

    const response = proxy(request as never) as {
      type: string;
      status?: number;
      body?: { error?: { code?: string } };
    };

    expect(response.type).toBe("json");
    expect(response.status).toBe(403);
    expect(response.body?.error?.code).toBe("DEV_PUBLIC_ACCESS_BLOCKED");
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("strips sensitive login query payload by redirecting to clean /login URL", () => {
    const request = makeRequest({
      pathname: "/login",
      host: "localhost:3000",
      query: "citizenId=1539900027713&password=secret",
    });

    const response = proxy(request as never) as {
      type: string;
      status?: number;
      location?: string;
    };

    expect(response.type).toBe("redirect");
    expect(response.status).toBe(307);
    expect(response.location).toBe("/login");
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("allows local development access when NEXT_ALLOW_PUBLIC_DEV is false", () => {
    const request = makeRequest({
      pathname: "/dashboard",
      host: "localhost:3000",
    });

    const response = proxy(request as never) as {
      type: string;
      status?: number;
      body?: { error?: { code?: string } };
    };
    expect(response.type).toBe("next");
    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  it("blocks dev internals on public hosts when NEXT_ALLOW_PUBLIC_DEV is false", () => {
    const request = makeRequest({
      pathname: "/_next/webpack-hmr",
      host: "public.example.com",
    });

    const response = proxy(request as never) as {
      type: string;
      status?: number;
      body?: { error?: { code?: string } };
    };
    expect(response.type).toBe("json");
    expect(response.status).toBe(404);
    expect(response.body?.error?.code).toBe("NOT_FOUND");
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("allows dev internals on local hosts when NEXT_ALLOW_PUBLIC_DEV is false", () => {
    const request = makeRequest({
      pathname: "/_next/webpack-hmr",
      host: "localhost:3000",
    });

    const response = proxy(request as never) as { type: string };
    expect(response.type).toBe("next");
    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  it("allows public development access when NEXT_ALLOW_PUBLIC_DEV is true", () => {
    vi.stubEnv("NEXT_ALLOW_PUBLIC_DEV", "true");
    const request = makeRequest({
      pathname: "/_next/webpack-hmr",
      host: "public.example.com",
    });

    const response = proxy(request as never) as { type: string };
    expect(response.type).toBe("next");
    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  it("blocks dev internals in production even when NEXT_ALLOW_PUBLIC_DEV is true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_ALLOW_PUBLIC_DEV", "true");
    const request = makeRequest({
      pathname: "/_next/webpack-hmr",
      host: "public.example.com",
    });

    const response = proxy(request as never) as {
      type: string;
      status?: number;
      body?: { error?: { code?: string } };
    };
    expect(response.type).toBe("json");
    expect(response.status).toBe(404);
    expect(response.body?.error?.code).toBe("NOT_FOUND");
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("does not trust x-forwarded-host when evaluating local dev access", () => {
    const request = makeRequest({
      pathname: "/dashboard",
      host: "public.example.com",
      forwardedHost: "localhost:3000",
    });

    const response = proxy(request as never) as {
      type: string;
      status?: number;
      body?: { error?: { code?: string } };
    };
    expect(response.type).toBe("json");
    expect(response.status).toBe(403);
    expect(response.body?.error?.code).toBe("DEV_PUBLIC_ACCESS_BLOCKED");
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("does not block non-next routes that happen to include hot-update text", () => {
    const request = makeRequest({
      pathname: "/docs/hot-update-policy",
      host: "localhost:3000",
    });

    const response = proxy(request as never) as { type: string };
    expect(response.type).toBe("next");
    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });
});

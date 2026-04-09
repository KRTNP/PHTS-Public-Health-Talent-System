import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { nextMock, jsonMock } = vi.hoisted(() => ({
  nextMock: vi.fn(() => ({ type: "next" })),
  jsonMock: vi.fn((body: unknown, init?: { status?: number }) => ({
    type: "json",
    status: init?.status ?? 200,
    body,
  })),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: nextMock,
    json: jsonMock,
  },
}));

import { proxy } from "@/proxy";

const makeRequest = (input: {
  pathname: string;
  host: string;
  forwardedHost?: string;
}) => {
  const headers = new Headers();
  headers.set("host", input.host);
  if (input.forwardedHost) {
    headers.set("x-forwarded-host", input.forwardedHost);
  }

  return {
    nextUrl: {
      pathname: input.pathname,
      host: input.host,
      hostname: input.host.split(":")[0],
    },
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

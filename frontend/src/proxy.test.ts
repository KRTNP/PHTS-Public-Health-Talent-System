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
}) => {
  const headers = new Headers();
  headers.set("host", input.host);

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
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowPublicDev = process.env.NEXT_ALLOW_PUBLIC_DEV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "development";
    process.env.NEXT_ALLOW_PUBLIC_DEV = "false";
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

  it("blocks local development access when NEXT_ALLOW_PUBLIC_DEV is false", () => {
    const request = makeRequest({
      pathname: "/dashboard",
      host: "localhost:3000",
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

  it("blocks dev internals on local hosts when NEXT_ALLOW_PUBLIC_DEV is false", () => {
    const request = makeRequest({
      pathname: "/_next/webpack-hmr",
      host: "localhost:3000",
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

  it("allows public development access when NEXT_ALLOW_PUBLIC_DEV is true", () => {
    process.env.NEXT_ALLOW_PUBLIC_DEV = "true";
    const request = makeRequest({
      pathname: "/_next/webpack-hmr",
      host: "public.example.com",
    });

    const response = proxy(request as never) as { type: string };
    expect(response.type).toBe("next");
    expect(nextMock).toHaveBeenCalledTimes(1);
  });

  it("blocks dev internals in production even when NEXT_ALLOW_PUBLIC_DEV is true", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_ALLOW_PUBLIC_DEV = "true";
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

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.NEXT_ALLOW_PUBLIC_DEV = originalAllowPublicDev;
  });
});

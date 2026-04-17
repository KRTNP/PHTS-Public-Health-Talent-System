import { createCsrfProtection } from "@middlewares/csrfProtection.js";

describe("createCsrfProtection", () => {
  const makeReq = (overrides: Record<string, unknown> = {}) =>
    ({
      method: "POST",
      headers: {},
      ...overrides,
    }) as any;

  const makeRes = () => {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    return { status, json } as any;
  };

  it("skips safe methods", () => {
    const next = jest.fn();
    const req = makeReq({ method: "GET" });
    const res = makeRes();
    const middleware = createCsrfProtection({ isOriginAllowed: () => true });

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows non-cookie authenticated unsafe requests", () => {
    const next = jest.fn();
    const req = makeReq({ headers: { authorization: "Bearer abc" } });
    const res = makeRes();
    const middleware = createCsrfProtection({ isOriginAllowed: () => true });

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks cookie-authenticated requests without origin", () => {
    const next = jest.fn();
    const req = makeReq({ headers: { cookie: "phts_token=abc" } });
    const res = makeRes();
    const middleware = createCsrfProtection({ isOriginAllowed: () => true });

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.status.mock.results[0].value.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "CSRF_ORIGIN_REQUIRED" }),
      }),
    );
  });

  it("allows trusted no-origin clients when explicitly configured", () => {
    const next = jest.fn();
    const req = makeReq({
      headers: { cookie: "phts_token=abc", "x-client-id": "trusted-sync" },
    });
    const res = makeRes();
    const middleware = createCsrfProtection({
      isOriginAllowed: () => true,
      isTrustedNoOriginClient: (request) =>
        request.headers["x-client-id"] === "trusted-sync",
    });

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks cookie-authenticated requests from forbidden origin", () => {
    const next = jest.fn();
    const req = makeReq({
      headers: {
        cookie: "phts_token=abc",
        origin: "https://evil.example",
      },
    });
    const res = makeRes();
    const middleware = createCsrfProtection({
      isOriginAllowed: (origin) => origin === "https://trusted.example",
    });

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.status.mock.results[0].value.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "CSRF_ORIGIN_FORBIDDEN" }),
      }),
    );
  });

  it("blocks cross-site fetch metadata for cookie-authenticated requests", () => {
    const next = jest.fn();
    const req = makeReq({
      headers: {
        cookie: "phts_token=abc",
        origin: "https://trusted.example",
        "sec-fetch-site": "cross-site",
      },
    });
    const res = makeRes();
    const middleware = createCsrfProtection({ isOriginAllowed: () => true });

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.status.mock.results[0].value.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "CSRF_FETCH_SITE_FORBIDDEN" }),
      }),
    );
  });

  it("allows cookie-authenticated requests from allowed same-site origin", () => {
    const next = jest.fn();
    const req = makeReq({
      headers: {
        cookie: "phts_token=abc",
        origin: "https://trusted.example",
        "sec-fetch-site": "same-origin",
      },
    });
    const res = makeRes();
    const middleware = createCsrfProtection({
      isOriginAllowed: (origin) => origin === "https://trusted.example",
    });

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

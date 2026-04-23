jest.mock("@config/redis.js", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

import redis from "@config/redis.js";
import { idempotency } from "@middlewares/idempotency.js";

describe("idempotency middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 409 when cached request hash mismatches multipart file metadata", async () => {
    (redis.get as jest.Mock).mockResolvedValue(
      JSON.stringify({
        status: 201,
        body: { success: true },
        headers: { "content-type": "application/json" },
        requestHash: JSON.stringify({
          body: { name: "memo" },
          files: [
            {
              field: "files",
              name: "memo.pdf",
              size: 10,
              type: "application/pdf",
            },
          ],
        }),
      }),
    );

    const req: any = {
      method: "POST",
      originalUrl: "/api/requests",
      body: { name: "memo" },
      files: {
        files: [
          {
            fieldname: "files",
            originalname: "memo.pdf",
            size: 11,
            mimetype: "application/pdf",
          },
        ],
      },
      user: { userId: 1 },
      header: (name: string) =>
        name.toLowerCase() === "idempotency-key" ? "abc-1" : undefined,
    };

    const json = jest.fn();
    const res: any = {
      status: jest.fn(() => ({ json })),
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    await idempotency()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Idempotency-Key payload mismatch",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("replays cached response when cache exists and hash matches", async () => {
    const requestHash = JSON.stringify({
      body: { note: "same" },
      files: [],
    });
    (redis.get as jest.Mock).mockResolvedValue(
      JSON.stringify({
        status: 200,
        body: { success: true, data: { ok: true } },
        headers: { "content-type": "application/json" },
        requestHash,
      }),
    );

    const req: any = {
      method: "POST",
      originalUrl: "/api/requests/1/submit",
      body: { note: "same" },
      user: { userId: 1 },
      header: (name: string) =>
        name.toLowerCase() === "idempotency-key" ? "abc-2" : undefined,
    };

    const json = jest.fn();
    const res: any = {
      status: jest.fn(() => ({ json })),
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    await idempotency()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, data: { ok: true } });
    expect(next).not.toHaveBeenCalled();
  });

  it("includes req.file metadata in request fingerprint for single upload routes", async () => {
    (redis.get as jest.Mock).mockResolvedValue(
      JSON.stringify({
        status: 201,
        body: { success: true },
        headers: { "content-type": "application/json" },
        requestHash: JSON.stringify({
          body: { title: "single" },
          files: [
            {
              field: "attachment",
              name: "proof.pdf",
              size: 1234,
              type: "application/pdf",
            },
          ],
        }),
      }),
    );

    const req: any = {
      method: "POST",
      originalUrl: "/api/support/tickets",
      body: { title: "single" },
      file: {
        fieldname: "attachment",
        originalname: "proof.pdf",
        size: 1234,
        mimetype: "application/pdf",
      },
      user: { userId: 1 },
      header: (name: string) =>
        name.toLowerCase() === "idempotency-key" ? "abc-3" : undefined,
    };

    const json = jest.fn();
    const res: any = {
      status: jest.fn(() => ({ json })),
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    await idempotency()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });
});

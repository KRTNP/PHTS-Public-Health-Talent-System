import request from "supertest";
import type { Application } from "express";

describe("CSRF cookie guard across high-risk routes", () => {
  let app: Application;
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "e2e-test-secret";
    process.env.FRONTEND_URL = "http://localhost:3000";
    ({ default: app } = await import("@/index.js"));
  });

  afterAll(() => {
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
      return;
    }
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  test.each([
    ["upload endpoint", "/api/support/tickets"],
    ["admin endpoint", "/api/system/maintenance"],
    ["sync endpoint", "/api/system/sync/sync"],
  ])("blocks %s when cookie auth has no origin", async (_label, path) => {
    const response = await request(app)
      .post(path)
      .set("Cookie", "phts_token=fake-cookie-token")
      .send({});

    expect(response.status).toBe(403);
    expect(response.body?.error?.code).toBe("CSRF_ORIGIN_REQUIRED");
  });

  test("blocks cookie auth with forbidden origin", async () => {
    const response = await request(app)
      .post("/api/system/maintenance")
      .set("Cookie", "phts_token=fake-cookie-token")
      .set("Origin", "https://evil.example")
      .send({ enabled: true });

    expect(response.status).toBe(403);
    expect(response.body?.error?.code).toBe("CORS_ORIGIN_FORBIDDEN");
  });

  test("blocks cookie auth with cross-site fetch metadata", async () => {
    const response = await request(app)
      .post("/api/system/maintenance")
      .set("Cookie", "phts_token=fake-cookie-token")
      .set("Origin", "http://localhost:3000")
      .set("Sec-Fetch-Site", "cross-site")
      .send({ enabled: true });

    expect(response.status).toBe(403);
    expect(response.body?.error?.code).toBe("CSRF_FETCH_SITE_FORBIDDEN");
  });

  test("does not block allowed same-origin request at CSRF layer", async () => {
    const response = await request(app)
      .post("/api/system/maintenance")
      .set("Cookie", "phts_token=fake-cookie-token")
      .set("Origin", "http://localhost:3000")
      .set("Sec-Fetch-Site", "same-origin")
      .send({ enabled: true });

    // CSRF passed; route then fails at auth/token validation.
    expect(response.status).toBe(401);
    expect(String(response.body?.error ?? "")).not.toContain("CSRF");
  });
});

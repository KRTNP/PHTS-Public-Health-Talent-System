import crypto from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "@jest/globals";
import {
  applyUploadResponseSecurityHeaders,
  validateStoredUploadFile,
} from "@config/upload-guard.js";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRXcAAAAASUVORK5CYII=";

async function createUploadedFileFixture(options: {
  originalName: string;
  mimetype: string;
  body: Buffer | string;
}) {
  const sessionId = crypto.randomUUID();
  const documentsRoot = path.resolve(process.cwd(), "uploads/documents");
  const destination = path.join(documentsRoot, sessionId);
  await mkdir(destination, { recursive: true });

  const extension = path.extname(options.originalName) || ".bin";
  const filename = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${extension}`;
  const filePath = path.join(destination, filename);
  await writeFile(filePath, options.body);

  const file = {
    destination,
    filename,
    originalname: options.originalName,
    mimetype: options.mimetype,
    path: filePath,
  } as Express.Multer.File;

  return {
    file,
    cleanup: async () => rm(destination, { recursive: true, force: true }),
  };
}

describe("upload security", () => {
  test("rejects html content even when named as an allowed image extension", async () => {
    const fixture = await createUploadedFileFixture({
      originalName: "proof.png",
      mimetype: "image/png",
      body: "<!doctype html><html><body>owned</body></html>",
    });

    try {
      await expect(
        validateStoredUploadFile(fixture.file),
      ).rejects.toThrow(/invalid file contents/i);
    } finally {
      await fixture.cleanup();
    }
  });

  test("accepts real png content with an allowed extension", async () => {
    const fixture = await createUploadedFileFixture({
      originalName: "proof.png",
      mimetype: "image/png",
      body: Buffer.from(PNG_1X1_BASE64, "base64"),
    });

    try {
      await expect(
        validateStoredUploadFile(fixture.file),
      ).resolves.toBeUndefined();
    } finally {
      await fixture.cleanup();
    }
  });

  test("forces non-previewable uploads to download as attachment", () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      },
    } as { setHeader: (name: string, value: string) => void };

    applyUploadResponseSecurityHeaders(
      res as never,
      "/tmp/uploads/documents/payload.html",
    );

    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("content-disposition")).toContain("attachment");
    expect(headers.get("content-security-policy")).toBe(
      "sandbox; default-src 'none';",
    );
  });

  test("keeps previewable uploads inline", () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader(name: string, value: string) {
        headers.set(name.toLowerCase(), value);
      },
    } as { setHeader: (name: string, value: string) => void };

    applyUploadResponseSecurityHeaders(
      res as never,
      "/tmp/uploads/documents/document.pdf",
    );

    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.has("content-disposition")).toBe(false);
    expect(headers.has("content-security-policy")).toBe(false);
  });
});

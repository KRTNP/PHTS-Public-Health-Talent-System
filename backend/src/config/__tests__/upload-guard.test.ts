import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "@jest/globals";
import {
  applyUploadResponseSecurityHeaders,
  validateStoredUploadFile,
} from "@config/upload-guard.js";

const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRXcAAAAASUVORK5CYII=";

describe("upload security", () => {
  test("rejects html content even when named as an allowed image extension", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "phts-upload-test-"));
    const filePath = path.join(dir, "proof.png");

    try {
      await writeFile(
        filePath,
        "<!doctype html><html><body>owned</body></html>",
        "utf8",
      );

      await expect(
        validateStoredUploadFile(filePath, "proof.png"),
      ).rejects.toThrow(/invalid file contents/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("accepts real png content with an allowed extension", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "phts-upload-test-"));
    const filePath = path.join(dir, "proof.png");

    try {
      await writeFile(filePath, Buffer.from(PNG_1X1_BASE64, "base64"));

      await expect(
        validateStoredUploadFile(filePath, "proof.png"),
      ).resolves.toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
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

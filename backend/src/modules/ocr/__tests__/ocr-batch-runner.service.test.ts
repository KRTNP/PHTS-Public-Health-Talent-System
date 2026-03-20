jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
}));

jest.mock("@/modules/ocr/services/ocr-local-tesseract.service.js", () => ({
  runLocalTesseract: jest.fn(),
}));

import { readFile } from "node:fs/promises";
import { runLocalTesseract } from "@/modules/ocr/services/ocr-local-tesseract.service.js";

describe("ocr batch runner service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("runs local tesseract for stored files and returns summarized counts", async () => {
    (readFile as jest.Mock).mockResolvedValue(Buffer.from("file"));
    (runLocalTesseract as jest.Mock)
      .mockResolvedValueOnce({ name: "a.pdf", ok: true, markdown: "a" })
      .mockResolvedValueOnce({ name: "b.pdf", ok: false, error: "bad" });

    const { runStoredFileOcrBatch } =
      await import("@/modules/ocr/services/ocr-batch-runner.service.js");

    const result = await runStoredFileOcrBatch([
      { file_name: "a.pdf", file_path: "uploads/a.pdf" },
      { file_name: "b.pdf", file_path: "uploads/b.pdf" },
    ]);

    expect(result).toEqual({
      count: 2,
      success_count: 1,
      failed_count: 1,
      results: [
        { name: "a.pdf", ok: true, markdown: "a" },
        { name: "b.pdf", ok: false, error: "bad" },
      ],
    });

    expect(runLocalTesseract).toHaveBeenNthCalledWith(
      1,
      "a.pdf",
      expect.any(Buffer),
    );
    expect(runLocalTesseract).toHaveBeenNthCalledWith(
      2,
      "b.pdf",
      expect.any(Buffer),
    );
  });

  it("maps unavailable local OCR errors to readable message", async () => {
    (readFile as jest.Mock).mockResolvedValue(Buffer.from("file"));
    (runLocalTesseract as jest.Mock).mockRejectedValue(
      new Error("OCR_MAIN_SERVICE_UNAVAILABLE"),
    );

    const { runStoredFileOcrBatch } =
      await import("@/modules/ocr/services/ocr-batch-runner.service.js");

    const result = await runStoredFileOcrBatch([
      { file_name: "memo.pdf", file_path: "uploads/memo.pdf" },
    ]);

    expect(result.results).toEqual([
      {
        name: "memo.pdf",
        ok: false,
        error: "ยังไม่ได้เปิดบริการ OCR หลัก",
      },
    ]);
  });

  it("resolves relative file paths from process cwd", async () => {
    const { resolveStoredOcrFilePath } =
      await import("@/modules/ocr/services/ocr-batch-runner.service.js");

    expect(resolveStoredOcrFilePath("/tmp/a.pdf")).toBe("/tmp/a.pdf");
    expect(resolveStoredOcrFilePath("uploads/a.pdf")).toContain(
      "/uploads/a.pdf",
    );
  });
});

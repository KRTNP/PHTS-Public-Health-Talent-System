jest.mock("@config/redis.js", () => ({
  __esModule: true,
  default: {
    lpush: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock("@/modules/ocr/repositories/ocr-request.repository.js", () => ({
  OcrRequestRepository: {
    updateRequestPrecheck: jest.fn().mockResolvedValue(undefined),
    findAttachments: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("@/modules/ocr/services/ocr-batch-runner.service.js", () => ({
  runStoredFileOcrBatch: jest.fn(),
}));

describe("ocr precheck service", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("marks request as failed when no attachments are available", async () => {
    const { OcrRequestRepository } =
      await import("@/modules/ocr/repositories/ocr-request.repository.js");
    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([]);

    const { processRequestOcrPrecheck } =
      await import("@/modules/ocr/services/ocr-precheck.service.js");
    await processRequestOcrPrecheck(11);

    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      11,
      expect.objectContaining({
        status: "failed",
        error: "No attachments to OCR",
      }),
    );
  });

  test("stores completed result when at least one attachment succeeds", async () => {
    const { OcrRequestRepository } =
      await import("@/modules/ocr/repositories/ocr-request.repository.js");
    const { runStoredFileOcrBatch } =
      await import("@/modules/ocr/services/ocr-batch-runner.service.js");

    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([
      { file_type: "OTHER", file_path: "uploads/a.pdf", file_name: "a.pdf" },
    ]);
    (runStoredFileOcrBatch as jest.Mock).mockResolvedValue({
      count: 1,
      success_count: 1,
      failed_count: 0,
      results: [{ name: "a.pdf", ok: true, markdown: "text" }],
    });

    const { processRequestOcrPrecheck } =
      await import("@/modules/ocr/services/ocr-precheck.service.js");
    await processRequestOcrPrecheck(12);

    expect(runStoredFileOcrBatch).toHaveBeenCalledWith([
      { file_name: "a.pdf", file_path: "uploads/a.pdf" },
    ]);
    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      12,
      expect.objectContaining({
        status: "completed",
        success_count: 1,
        failed_count: 0,
      }),
    );
  });

  test("keeps first-pass tesseract result even when quality is low", async () => {
    const { OcrRequestRepository } =
      await import("@/modules/ocr/repositories/ocr-request.repository.js");
    const { runStoredFileOcrBatch } =
      await import("@/modules/ocr/services/ocr-batch-runner.service.js");

    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([
      { file_type: "OTHER", file_path: "uploads/a.pdf", file_name: "a.pdf" },
    ]);
    (runStoredFileOcrBatch as jest.Mock).mockResolvedValue({
      count: 1,
      success_count: 1,
      failed_count: 0,
      results: [
        {
          ok: true,
          markdown: "คำสั่งกลุ่มงานเภสัชกรรม\nที่ ๑/ ๒๕๒๐๕\nlow quality",
          name: "a.pdf",
          quality: { passed: false, required_fields: 3, captured_fields: 1 },
        },
      ],
    });

    const { processRequestOcrPrecheck } =
      await import("@/modules/ocr/services/ocr-precheck.service.js");
    await processRequestOcrPrecheck(13);

    expect(runStoredFileOcrBatch).toHaveBeenCalledTimes(1);
    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      13,
      expect.objectContaining({
        status: "completed",
        results: [
          expect.objectContaining({
            name: "a.pdf",
            quality: expect.objectContaining({ passed: false }),
          }),
        ],
      }),
    );
  });
});

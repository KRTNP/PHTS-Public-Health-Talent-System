import { RequestCommandService } from "@/modules/request/services/command.service.js";
import { requestRepository } from "@/modules/request/data/repositories/request.repository.js";
import { OcrRequestRepository } from "@/modules/ocr/repositories/ocr-request.repository.js";
import * as localTesseractService from "@/modules/ocr/services/ocr-local-tesseract.service.js";

jest.mock("node:fs/promises", () => ({
  readFile: jest.fn(),
}));

describe("RequestCommandService OCR methods", () => {
  const service = new RequestCommandService();

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(requestRepository, "findById").mockResolvedValue(null as any);
  });

  describe("persistManualOcrPrecheck", () => {
    it("stores manual OCR result in dedicated OCR table for PTS officer", async () => {
      jest.spyOn(requestRepository, "findById").mockResolvedValue({
        request_id: 67909,
        user_id: 46409,
        status: "APPROVED",
      } as any);
      const upsertSpy = jest
        .spyOn(OcrRequestRepository, "upsertRequestPrecheck")
        .mockResolvedValue();

      await service.persistManualOcrPrecheck(67909, 46941, "PTS_OFFICER", {
        worker: "browser-manual",
        count: 1,
        success_count: 1,
        failed_count: 0,
        results: [
          {
            name: "license.pdf",
            ok: true,
            markdown: "ocr text",
          },
        ],
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        67909,
        expect.objectContaining({
          status: "completed",
          source: "MANUAL_VERIFY",
          worker: "browser-manual",
          success_count: 1,
          failed_count: 0,
          results: [
            expect.objectContaining({
              name: "license.pdf",
              ok: true,
              markdown: "ocr text",
            }),
          ],
        }),
      );
    });

    it("runs OCR for request attachments through backend and merges results", async () => {
      const { readFile } = await import("node:fs/promises");

      jest.spyOn(requestRepository, "findById").mockResolvedValue({
        request_id: 67909,
        user_id: 46409,
        status: "PENDING",
      } as any);
      jest.spyOn(requestRepository, "findAttachmentById").mockResolvedValue({
        attachment_id: 22,
        request_id: 67909,
        file_name: "order.pdf",
        file_path: "uploads/order.pdf",
      } as any);
      jest
        .spyOn(OcrRequestRepository, "findRequestPrecheck")
        .mockResolvedValue(null);
      jest
        .spyOn(localTesseractService, "runLocalTesseract")
        .mockResolvedValueOnce({
          name: "order.pdf",
          ok: true,
          markdown: "order text",
        } as any);
      (readFile as jest.Mock).mockResolvedValue(Buffer.from("file"));
      const upsertSpy = jest
        .spyOn(OcrRequestRepository, "upsertRequestPrecheck")
        .mockResolvedValue();

      const result = await service.runRequestAttachmentsOcr(
        67909,
        46941,
        "PTS_OFFICER",
        {
          attachments: [{ attachment_id: 22 }],
        },
      );

      expect(result).toEqual(
        expect.objectContaining({
          saved: true,
          count: 1,
          success_count: 1,
          failed_count: 0,
        }),
      );
      expect(upsertSpy).toHaveBeenCalledWith(
        67909,
        expect.objectContaining({
          results: [expect.objectContaining({ name: "order.pdf" })],
        }),
      );
    });

    it("clears OCR result for a single request attachment by file name", async () => {
      jest.spyOn(requestRepository, "findById").mockResolvedValue({
        request_id: 67909,
        user_id: 46409,
        status: "PENDING",
      } as any);
      jest
        .spyOn(OcrRequestRepository, "findRequestPrecheck")
        .mockResolvedValue({
          request_id: 67909,
          status: "completed",
          results: [
            { name: "page-5-6.pdf", ok: true, markdown: "ocr text" },
            { name: "memo.pdf", ok: true, markdown: "memo text" },
          ],
        } as any);
      const upsertSpy = jest
        .spyOn(OcrRequestRepository, "upsertRequestPrecheck")
        .mockResolvedValue();

      const result = await service.clearRequestAttachmentOcr(
        67909,
        46941,
        "PTS_OFFICER",
        "page-5-6.pdf",
      );

      expect(result).toEqual({
        saved: true,
        count: 1,
        success_count: 1,
        failed_count: 0,
      });
      expect(upsertSpy).toHaveBeenCalledWith(
        67909,
        expect.objectContaining({
          results: [expect.objectContaining({ name: "memo.pdf" })],
        }),
      );
    });
  });

  describe("persistEligibilityManualOcrPrecheck", () => {
    it("stores manual OCR result for eligibility detail attachments", async () => {
      jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
        eligibility_id: 2978,
        citizen_id: "1570400181863",
      } as any);
      const upsertSpy = jest
        .spyOn(requestRepository, "upsertEligibilityOcrPrecheck")
        .mockResolvedValue();

      await service.persistEligibilityManualOcrPrecheck(
        2978,
        46941,
        "PTS_OFFICER",
        {
          worker: "browser-manual",
          count: 1,
          success_count: 1,
          failed_count: 0,
          results: [
            {
              name: "memo.pdf",
              ok: true,
              markdown: "ocr text",
            },
          ],
        },
      );

      expect(upsertSpy).toHaveBeenCalledWith(
        2978,
        expect.objectContaining({
          status: "completed",
          source: "MANUAL_VERIFY",
          worker: "browser-manual",
          success_count: 1,
          failed_count: 0,
          results: [
            expect.objectContaining({
              name: "memo.pdf",
              ok: true,
              markdown: "ocr text",
            }),
          ],
        }),
      );
    });

    it("runs OCR for allowance attachments through backend and merges results", async () => {
      const { readFile } = await import("node:fs/promises");

      jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
        eligibility_id: 2978,
        request_id: 67909,
      } as any);
      jest
        .spyOn(requestRepository, "findEligibilityAttachmentById")
        .mockResolvedValue({
          attachment_id: 11,
          eligibility_id: 2978,
          file_name: "memo.pdf",
          file_path: "uploads/memo.pdf",
        } as any);
      jest.spyOn(requestRepository, "findAttachmentById").mockResolvedValue({
        attachment_id: 22,
        request_id: 67909,
        file_name: "order.pdf",
        file_path: "uploads/order.pdf",
      } as any);
      jest
        .spyOn(requestRepository, "findEligibilityOcrPrecheck")
        .mockResolvedValue({
          results_json: JSON.stringify([
            { name: "old.pdf", ok: true, markdown: "old text" },
          ]),
        } as any);
      jest
        .spyOn(localTesseractService, "runLocalTesseract")
        .mockResolvedValueOnce({
          name: "memo.pdf",
          ok: true,
          markdown: "memo text",
        } as any)
        .mockResolvedValueOnce({
          name: "order.pdf",
          ok: true,
          markdown: "order text",
        } as any);
      (readFile as jest.Mock).mockResolvedValue(Buffer.from("file"));
      const upsertSpy = jest
        .spyOn(requestRepository, "upsertEligibilityOcrPrecheck")
        .mockResolvedValue();

      const result = await service.runEligibilityAttachmentsOcr(
        2978,
        46941,
        "PTS_OFFICER",
        {
          attachments: [
            { attachment_id: 11, source: "eligibility" },
            { attachment_id: 22, source: "request" },
          ],
        },
      );

      expect(result).toEqual(
        expect.objectContaining({
          saved: true,
          count: 3,
          success_count: 3,
          failed_count: 0,
        }),
      );
      expect(upsertSpy).toHaveBeenCalledWith(
        2978,
        expect.objectContaining({
          results: [
            expect.objectContaining({ name: "old.pdf" }),
            expect.objectContaining({ name: "memo.pdf" }),
            expect.objectContaining({ name: "order.pdf" }),
          ],
        }),
      );
    });

    it("clears OCR result for a single eligibility attachment by file name", async () => {
      jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
        eligibility_id: 2978,
        citizen_id: "1570400181863",
      } as any);
      jest
        .spyOn(requestRepository, "findEligibilityOcrPrecheck")
        .mockResolvedValue({
          results_json: JSON.stringify([
            { name: "page-5-6.pdf", ok: true, markdown: "ocr text" },
            { name: "memo.pdf", ok: true, markdown: "memo text" },
          ]),
        } as any);
      const upsertSpy = jest
        .spyOn(requestRepository, "upsertEligibilityOcrPrecheck")
        .mockResolvedValue();

      const result = await service.clearEligibilityAttachmentOcr(
        2978,
        46941,
        "PTS_OFFICER",
        "page-5-6.pdf",
      );

      expect(result).toEqual({
        saved: true,
        count: 1,
        success_count: 1,
        failed_count: 0,
      });
      expect(upsertSpy).toHaveBeenCalledWith(
        2978,
        expect.objectContaining({
          status: "completed",
          count: 1,
          success_count: 1,
          failed_count: 0,
          results: [expect.objectContaining({ name: "memo.pdf" })],
        }),
      );
    });

    it("keeps OCR results empty when clearing file without existing OCR result", async () => {
      jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
        eligibility_id: 2978,
        citizen_id: "1570400181863",
      } as any);
      jest
        .spyOn(requestRepository, "findEligibilityOcrPrecheck")
        .mockResolvedValue({
          results_json: JSON.stringify([]),
        } as any);
      const upsertSpy = jest
        .spyOn(requestRepository, "upsertEligibilityOcrPrecheck")
        .mockResolvedValue();

      const result = await service.clearEligibilityAttachmentOcr(
        2978,
        46941,
        "PTS_OFFICER",
        "page-5-6.pdf",
      );

      expect(result).toEqual({
        saved: true,
        count: 0,
        success_count: 0,
        failed_count: 0,
      });
      expect(upsertSpy).toHaveBeenCalledWith(
        2978,
        expect.objectContaining({
          results: [],
        }),
      );
    });
  });
});

import { RequestCommandService } from "@/modules/request/services/command.service.js";
import { requestRepository } from "@/modules/request/data/repositories/request.repository.js";
import { getConnection } from "@config/database.js";

jest.mock("@config/database.js", () => ({
  getConnection: jest.fn(),
}));

jest.mock("@/modules/audit/services/audit.service.js", () => ({
  AuditEventType: { OTHER: "OTHER" },
  emitAuditEvent: jest.fn().mockResolvedValue(1),
}));

describe("RequestCommandService eligibility attachments", () => {
  const service = new RequestCommandService();

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(requestRepository, "findAttachmentsWithMetadata").mockResolvedValue([]);
  });

  it("stores uploaded files even when eligibility has no source request", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    (getConnection as jest.Mock).mockResolvedValue(connection);

    jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
      eligibility_id: 2971,
      request_id: null,
    } as any);
    const insertAttachment = jest
      .spyOn(requestRepository, "insertEligibilityAttachment")
      .mockResolvedValue();
    jest.spyOn(requestRepository, "findEligibilityAttachments")
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          attachment_id: 91,
          eligibility_id: 2971,
          file_type: "OTHER",
          file_path: "uploads/documents/demo/file.pdf",
          file_name: "เอกสารเพิ่มเติม.pdf",
          uploaded_at: "2026-03-03T10:00:00.000Z",
        } as any,
      ]);

    const result = await service.addEligibilityAttachments(2971, 10, [
      {
        fieldname: "files",
        originalname: "เอกสารเพิ่มเติม.pdf",
        path: "uploads/documents/demo/file.pdf",
      } as Express.Multer.File,
    ]);

    expect(insertAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        eligibility_id: 2971,
        file_name: "เอกสารเพิ่มเติม.pdf",
      }),
      connection as any,
    );
    expect(result).toHaveLength(1);
  });

  it("stores uploaded files on the eligibility record", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    (getConnection as jest.Mock).mockResolvedValue(connection);

    jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
      eligibility_id: 2971,
      request_id: 501,
    } as any);
    const insertAttachment = jest
      .spyOn(requestRepository, "insertEligibilityAttachment")
      .mockResolvedValue();
    jest.spyOn(requestRepository, "findEligibilityAttachments")
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          attachment_id: 88,
          eligibility_id: 2971,
          file_type: "OTHER",
          file_path: "uploads/documents/demo/file.pdf",
          file_name: "เอกสารเพิ่มเติม.pdf",
          uploaded_at: "2026-03-03T10:00:00.000Z",
        } as any,
      ]);

    const result = await service.addEligibilityAttachments(2971, 10, [
      {
        fieldname: "files",
        originalname: "เอกสารเพิ่มเติม.pdf",
        path: "uploads/documents/demo/file.pdf",
      } as Express.Multer.File,
    ]);

    expect(connection.beginTransaction).toHaveBeenCalled();
    expect(insertAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        eligibility_id: 2971,
        file_name: "เอกสารเพิ่มเติม.pdf",
      }),
      connection as any,
    );
    expect(result).toHaveLength(1);
  });

  it("strips repeated internal upload wrappers from eligibility attachment names", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    (getConnection as jest.Mock).mockResolvedValue(connection);

    jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
      eligibility_id: 2971,
      request_id: 501,
    } as any);
    const insertAttachment = jest
      .spyOn(requestRepository, "insertEligibilityAttachment")
      .mockResolvedValue();
    jest.spyOn(requestRepository, "findEligibilityAttachments").mockResolvedValue([]);

    await service.addEligibilityAttachments(2971, 10, [
      {
        fieldname: "files",
        originalname:
          "46941_1772558669225_46941_1772545682775_____________________________________________________________________fce73844.pdf",
        path: "uploads/documents/demo/file.pdf",
      } as Express.Multer.File,
    ]);

    expect(insertAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        file_name: "46941_1772545682775_____________________________________________________________________fce73844.pdf",
      }),
      connection as any,
    );
  });

  it("reuses source request display name when uploaded file matches request attachment hash", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    (getConnection as jest.Mock).mockResolvedValue(connection);

    jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
      eligibility_id: 2971,
      request_id: 501,
    } as any);
    jest.spyOn(requestRepository, "findAttachmentsWithMetadata").mockResolvedValue([
      {
        attachment_id: 328,
        request_id: 501,
        file_name: "สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf",
        file_path:
          "uploads/documents/demo/46941_1772545682775_________________________________________________________________________________________a5ffd1a4.pdf",
      } as any,
    ]);
    const insertAttachment = jest
      .spyOn(requestRepository, "insertEligibilityAttachment")
      .mockResolvedValue();
    jest.spyOn(requestRepository, "findEligibilityAttachments").mockResolvedValue([]);

    await service.addEligibilityAttachments(2971, 10, [
      {
        fieldname: "files",
        originalname:
          "46941_1772545682775_________________________________________________________________________________________a5ffd1a4.pdf",
        path: "uploads/documents/demo/file.pdf",
      } as Express.Multer.File,
    ]);

    expect(insertAttachment).toHaveBeenCalledWith(
      expect.objectContaining({
        file_name: "สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf",
      }),
      connection as any,
    );
  });

  it("rejects duplicate eligibility attachment names", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    (getConnection as jest.Mock).mockResolvedValue(connection);

    jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
      eligibility_id: 2971,
      request_id: 501,
    } as any);
    jest.spyOn(requestRepository, "findEligibilityAttachments").mockResolvedValue([
      {
        attachment_id: 88,
        eligibility_id: 2971,
        file_name: "เอกสารเพิ่มเติม.pdf",
      } as any,
    ]);

    await expect(
      service.addEligibilityAttachments(2971, 10, [
        {
          fieldname: "files",
          originalname: "เอกสารเพิ่มเติม.pdf",
          path: "uploads/documents/demo/file.pdf",
        } as Express.Multer.File,
      ]),
    ).rejects.toThrow("มีไฟล์ชื่อนี้อยู่แล้ว");
  });

  it("rejects deleting an attachment that does not belong to the eligibility record", async () => {
    jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
      eligibility_id: 2971,
      request_id: 501,
    } as any);
    jest.spyOn(requestRepository, "findEligibilityAttachmentById").mockResolvedValue({
      attachment_id: 88,
      eligibility_id: 999,
    } as any);

    await expect(
      service.removeEligibilityAttachment(2971, 88, 10),
    ).rejects.toThrow("ไม่ได้อยู่ในรายการสิทธินี้");
  });

  it("removes OCR result for deleted eligibility attachment when no request attachment with same name remains", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    (getConnection as jest.Mock).mockResolvedValue(connection);

    jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
      eligibility_id: 2971,
      request_id: null,
    } as any);
    jest.spyOn(requestRepository, "findEligibilityAttachmentById").mockResolvedValue({
      attachment_id: 88,
      eligibility_id: 2971,
      file_name: "page-5-6.pdf",
      file_path: "uploads/documents/demo/page-5-6.pdf",
    } as any);
    jest.spyOn(requestRepository, "deleteEligibilityAttachmentById").mockResolvedValue();
    jest.spyOn(requestRepository, "findEligibilityOcrPrecheck").mockResolvedValue({
      results_json: JSON.stringify([
        { name: "page-5-6.pdf", ok: true, markdown: "ocr text" },
        { name: "memo.pdf", ok: true, markdown: "memo text" },
      ]),
    } as any);
    const upsertSpy = jest
      .spyOn(requestRepository, "upsertEligibilityOcrPrecheck")
      .mockResolvedValue();

    await service.removeEligibilityAttachment(2971, 88, 10);

    expect(upsertSpy).toHaveBeenCalledWith(
      2971,
      expect.objectContaining({
        count: 1,
        success_count: 1,
        failed_count: 0,
        results: [expect.objectContaining({ name: "memo.pdf" })],
      }),
    );
  });

  it("keeps OCR result when deleted eligibility attachment still exists from request source with the same file name", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    (getConnection as jest.Mock).mockResolvedValue(connection);

    jest.spyOn(requestRepository, "findEligibilityById").mockResolvedValue({
      eligibility_id: 2971,
      request_id: 501,
    } as any);
    jest.spyOn(requestRepository, "findEligibilityAttachmentById").mockResolvedValue({
      attachment_id: 88,
      eligibility_id: 2971,
      file_name: "สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf",
      file_path: "uploads/documents/demo/page.pdf",
    } as any);
    jest.spyOn(requestRepository, "deleteEligibilityAttachmentById").mockResolvedValue();
    jest.spyOn(requestRepository, "findAttachmentsWithMetadata").mockResolvedValue([
      {
        attachment_id: 328,
        request_id: 501,
        file_name: "สรุปการดำเนินการปรับปรุงและแก้ไขระบบCMES.pdf",
      } as any,
    ]);
    const upsertSpy = jest
      .spyOn(requestRepository, "upsertEligibilityOcrPrecheck")
      .mockResolvedValue();

    await service.removeEligibilityAttachment(2971, 88, 10);

    expect(upsertSpy).not.toHaveBeenCalled();
  });
});

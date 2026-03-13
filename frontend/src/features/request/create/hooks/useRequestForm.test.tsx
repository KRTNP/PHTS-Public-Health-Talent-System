import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRequestForm } from "@/features/request/create/hooks/useRequestForm";

const pushMock = vi.fn();
const createRequestMock = vi.fn();
const updateRequestMock = vi.fn();
const getRequestByIdMock = vi.fn();
const submitRequestMock = vi.fn();
const updateRateMappingMock = vi.fn();
const confirmAttachmentsApiMock = vi.fn();
const authUser = {
  role: "PTS_OFFICER",
  firstName: "ละเอียด",
  lastName: "แก้วประเสริฐ",
};
const prefillData = {
  citizen_id: "1570400181863",
  title: "นางสาว",
  first_name: "กันยกร",
  last_name: "กาญจนวัฒนากุล",
  position_name: "พยาบาลวิชาชีพ",
  position_number: "210008",
  department: "กลุ่มงานการพยาบาลผู้ป่วยอายุรกรรม",
  sub_department: "หออภิบาลผู้ป่วยวิกฤตอายุรกรรม (ICU Med.)",
  employee_type: "CIVIL_SERVANT",
  first_entry_date: "2026-03-03",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/features/request/core/hooks", () => ({
  usePrefill: () => ({
    data: prefillData,
  }),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    user: authUser,
  }),
}));

vi.mock("@/features/request/core/api", () => ({
  createRequest: (...args: unknown[]) => createRequestMock(...args),
  updateRequest: (...args: unknown[]) => updateRequestMock(...args),
  getRequestById: (...args: unknown[]) => getRequestByIdMock(...args),
  submitRequest: (...args: unknown[]) => submitRequestMock(...args),
  updateRateMapping: (...args: unknown[]) => updateRateMappingMock(...args),
  confirmAttachments: (...args: unknown[]) => confirmAttachmentsApiMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useRequestForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    createRequestMock.mockResolvedValue({
      request_id: 999,
      attachments: [],
    });
    updateRequestMock.mockResolvedValue({
      request_id: 999,
      attachments: [],
    });
    getRequestByIdMock.mockResolvedValue({
      request_id: 999,
      attachments: [],
      ocr_precheck: null,
    });
    confirmAttachmentsApiMock.mockResolvedValue({ confirmed: true });
  });

  it("does not create draft during attachment confirmation for officer on-behalf flow", async () => {
    const { result } = renderHook(() =>
      useRequestForm({
        prefillUserId: 46409,
        returnPath: "/pts-officer/requests",
      }),
    );

    const file = new File(["attachment"], "officer-test.pdf", {
      type: "application/pdf",
    });

    act(() => {
      result.current.handleUploadFile(file);
    });

    let confirmed = false;
    await act(async () => {
      confirmed = await result.current.confirmAttachments();
    });

    expect(confirmed).toBe(true);
    expect(createRequestMock).not.toHaveBeenCalled();
    expect(updateRequestMock).not.toHaveBeenCalled();
    expect(confirmAttachmentsApiMock).not.toHaveBeenCalled();
  });

  it("autosaves draft shortly after first attachment upload", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRequestForm());

    const file = new File(["attachment"], "first-upload.pdf", {
      type: "application/pdf",
    });

    act(() => {
      result.current.handleUploadFile(file);
    });

    expect(createRequestMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(createRequestMock).toHaveBeenCalledTimes(1);
    expect(updateRequestMock).not.toHaveBeenCalled();
  });

  it("autosaves rate mapping updates after draft persistence starts from attachments", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRequestForm());

    act(() => {
      result.current.handleUploadFile(
        new File(["attachment"], "for-rate-mapping.pdf", {
          type: "application/pdf",
        }),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(createRequestMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.updateFormData("rateMapping", {
        groupId: "group2",
        itemId: "2.1",
        amount: 1234,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(updateRequestMock).toHaveBeenCalledTimes(1);
  });

  it("autosaves signature updates after draft persistence starts from attachments", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRequestForm());

    act(() => {
      result.current.handleUploadFile(
        new File(["attachment"], "for-signature.pdf", {
          type: "application/pdf",
        }),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(createRequestMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.updateFormData("signatureMode", "NEW");
      result.current.updateFormData("signature", "data:image/png;base64,TESTSIGNATURE");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(updateRequestMock).toHaveBeenCalledTimes(1);
  });

  it("updates autosave status to saved after autosave success", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRequestForm());

    act(() => {
      result.current.handleUploadFile(
        new File(["attachment"], "autosave-status.pdf", {
          type: "application/pdf",
        }),
      );
    });

    expect(result.current.autosaveStatus).toBe("idle");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.autosaveStatus).toBe("saved");
    expect(result.current.autosaveLastSavedAt).toBeTruthy();
  });

  it("polls OCR status automatically while precheck is queued/processing", async () => {
    vi.useFakeTimers();
    createRequestMock.mockResolvedValueOnce({
      request_id: 999,
      attachments: [],
      ocr_precheck: {
        request_id: 999,
        status: "queued",
        results: [],
      },
    });
    getRequestByIdMock
      .mockResolvedValueOnce({
        request_id: 999,
        attachments: [],
        ocr_precheck: {
          request_id: 999,
          status: "processing",
          results: [],
        },
      })
      .mockResolvedValueOnce({
        request_id: 999,
        attachments: [],
        ocr_precheck: {
          request_id: 999,
          status: "completed",
          results: [{ name: "queued.pdf", ok: true, document_kind: "general" }],
        },
      });

    const { result } = renderHook(() => useRequestForm());

    act(() => {
      result.current.handleUploadFile(
        new File(["attachment"], "queued.pdf", {
          type: "application/pdf",
        }),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(createRequestMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });

    expect(getRequestByIdMock).toHaveBeenCalled();
    expect(result.current.ocrPrecheck?.status).toBe("completed");
  });

  it("sets effectiveDate from assignment-order OCR effective date", async () => {
    vi.useFakeTimers();
    createRequestMock.mockResolvedValueOnce({
      request_id: 999,
      attachments: [],
      ocr_precheck: {
        request_id: 999,
        status: "completed",
        results: [
          {
            name: "page-5-6.pdf",
            ok: true,
            document_kind: "assignment_order",
            markdown: `
ที่ 1/2568
เรื่อง ยกเลิกและมอบหมายเจ้าหน้าที่รับผิดชอบในการปฏิบัติงาน
ทั้งนี้ ตั้งแต่วันที่ 1 พฤศจิกายน พ.ศ. 2568
            `,
          },
        ],
      },
    });

    const { result } = renderHook(() => useRequestForm());

    act(() => {
      result.current.handleUploadFile(
        new File(["attachment"], "page-5-6.pdf", {
          type: "application/pdf",
        }),
      );
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(result.current.formData.effectiveDate).toBe("2025-11-01");
  });
});

import { describe, expect, it, jest } from "@jest/globals";
import { ValidationError } from "@shared/utils/errors.js";
import { dispatchRequestAction } from "@/modules/request/api/helpers/request-action-dispatcher.helper.js";
import { requestApprovalService } from "@/modules/request/services/approval.service.js";

jest.mock("@/modules/request/services/approval.service.js", () => ({
  requestApprovalService: {
    approveRequest: jest.fn(),
    rejectRequest: jest.fn(),
    returnRequest: jest.fn(),
  },
}));

describe("request-action-dispatcher.helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("dispatches APPROVE with decoded signature", async () => {
    const signatureBase64 = Buffer.from("sig-binary").toString("base64");
    (requestApprovalService.approveRequest as jest.Mock).mockResolvedValue({
      request_id: 12,
      status: "PENDING",
    });

    await dispatchRequestAction({
      action: "APPROVE",
      requestId: 12,
      userId: 99,
      userRole: "HEAD_HR",
      comment: "ok",
      signatureBase64,
    });

    expect(requestApprovalService.approveRequest).toHaveBeenCalledWith(
      12,
      99,
      "HEAD_HR",
      "ok",
      Buffer.from("sig-binary"),
    );
  });

  it("dispatches REJECT and RETURN", async () => {
    (requestApprovalService.rejectRequest as jest.Mock).mockResolvedValue({
      request_id: 21,
      status: "REJECTED",
    });
    (requestApprovalService.returnRequest as jest.Mock).mockResolvedValue({
      request_id: 21,
      status: "RETURNED",
    });

    await dispatchRequestAction({
      action: "REJECT",
      requestId: 21,
      userId: 88,
      userRole: "DIRECTOR",
      comment: "no",
    });

    await dispatchRequestAction({
      action: "RETURN",
      requestId: 21,
      userId: 88,
      userRole: "DIRECTOR",
      comment: "revise",
    });

    expect(requestApprovalService.rejectRequest).toHaveBeenCalledWith(
      21,
      88,
      "DIRECTOR",
      "no",
    );
    expect(requestApprovalService.returnRequest).toHaveBeenCalledWith(
      21,
      88,
      "DIRECTOR",
      "revise",
    );
  });

  it("throws ValidationError on unsupported action", async () => {
    await expect(
      dispatchRequestAction({
        action: "INVALID_ACTION",
        requestId: 1,
        userId: 1,
        userRole: "PTS_OFFICER",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

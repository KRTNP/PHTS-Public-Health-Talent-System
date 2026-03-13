import { PeriodStatus } from "@/modules/payroll/entities/payroll.entity.js";

jest.mock("@/modules/notification/services/notification.service.js", () => ({
  NotificationService: {
    notifyRole: jest.fn(),
  },
}));

jest.mock("@/modules/audit/services/audit.service.js", () => ({
  emitAuditEvent: jest.fn(),
  AuditEventType: {
    PERIOD_APPROVE: "PERIOD_APPROVE",
    PERIOD_CLOSE: "PERIOD_CLOSE",
    PERIOD_REJECT: "PERIOD_REJECT",
    PERIOD_FREEZE: "PERIOD_FREEZE",
    PERIOD_SUBMIT: "PERIOD_SUBMIT",
    PERIOD_CREATE: "PERIOD_CREATE",
  },
}));

jest.mock("@/modules/payroll/repositories/payroll.repository.js", () => ({
  PayrollRepository: {
    getConnection: jest.fn(),
    findPeriodByIdForUpdate: jest.fn(),
    updatePeriodStatus: jest.fn(),
    updatePeriodLock: jest.fn(),
    updatePeriodFreeze: jest.fn(),
    updatePeriodSnapshotStatus: jest.fn(),
    clearProfessionReviewsByPeriod: jest.fn(),
  },
}));

jest.mock("@/modules/snapshot/services/snapshot.service.js", () => ({
  enqueuePeriodSnapshotGeneration: jest.fn(),
  SnapshotStatus: {
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    READY: "READY",
    FAILED: "FAILED",
  },
}));

jest.mock("@/modules/payroll/services/workflow/payroll-review.service.js", () => ({
  PayrollReviewService: {
    getRequiredProfessionCodes: jest.fn(),
    getReviewedProfessionCodes: jest.fn(),
  },
}));

import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";
import { PayrollReviewService } from "@/modules/payroll/services/workflow/payroll-review.service.js";
import { PayrollWorkflowService } from "@/modules/payroll/services/workflow/payroll-workflow.service.js";

describe("PayrollWorkflowService.updatePeriodStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("freezes the period when submitting to HR", async () => {
    const conn = {
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };

    (PayrollRepository.getConnection as jest.Mock).mockResolvedValue(conn);
    (PayrollRepository.findPeriodByIdForUpdate as jest.Mock).mockResolvedValue({
      period_id: 38,
      period_month: 1,
      period_year: 2026,
      status: PeriodStatus.OPEN,
    });
    (PayrollReviewService.getRequiredProfessionCodes as jest.Mock).mockResolvedValue(["NURSE"]);
    (PayrollReviewService.getReviewedProfessionCodes as jest.Mock).mockResolvedValue(["NURSE"]);

    const result = await PayrollWorkflowService.updatePeriodStatus(38, "SUBMIT", 77);

    expect(PayrollRepository.updatePeriodLock).toHaveBeenCalledWith(38, true, conn);
    expect(PayrollRepository.updatePeriodFreeze).toHaveBeenCalledWith(38, true, 77, conn);
    expect(PayrollRepository.updatePeriodStatus).toHaveBeenCalledWith(
      38,
      PeriodStatus.WAITING_HR,
      conn,
    );
    expect(result).toEqual({ success: true, status: PeriodStatus.WAITING_HR });
  });
});

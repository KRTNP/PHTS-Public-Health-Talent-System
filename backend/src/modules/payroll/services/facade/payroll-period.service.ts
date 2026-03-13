import { PoolConnection } from "mysql2/promise";
import {
  PayPeriod,
  PeriodStatus,
} from "@/modules/payroll/entities/payroll.entity.js";
import {
  PayrollWorkflowService,
  PeriodWorkflowAction,
} from "@/modules/payroll/services/workflow/payroll-workflow.service.js";
import { PayrollReviewService } from "@/modules/payroll/services/workflow/payroll-review.service.js";
import { PayrollPeriodItemService } from "@/modules/payroll/services/workflow/payroll-period-item.service.js";

export class PayrollPeriodService {
  static canRoleViewPeriod(
    role: string | null | undefined,
    status: PeriodStatus | string,
  ): boolean {
    return PayrollWorkflowService.canRoleViewPeriod(role, status);
  }

  static async ensurePeriodVisibleForRole(
    periodId: number,
    role: string | null | undefined,
  ): Promise<PayPeriod> {
    return PayrollWorkflowService.ensurePeriodVisibleForRole(periodId, role);
  }

  static async getPeriodByMonthYear(
    year: number,
    month: number,
  ): Promise<PayPeriod | null> {
    return PayrollWorkflowService.getPeriodByMonthYear(year, month);
  }

  static async getOrCreatePeriod(
    year: number,
    month: number,
    createdBy?: number | null,
  ): Promise<PayPeriod> {
    return PayrollWorkflowService.getOrCreatePeriod(year, month, createdBy);
  }

  static async updatePeriodStatus(
    periodId: number,
    action: PeriodWorkflowAction,
    actorId: number,
    reason?: string,
  ) {
    return PayrollWorkflowService.updatePeriodStatus(
      periodId,
      action,
      actorId,
      reason,
    );
  }

  static async hardDeletePeriod(periodId: number, actorId: number) {
    return PayrollWorkflowService.hardDeletePeriod(periodId, actorId);
  }

  static async getPeriodById(periodId: number) {
    return PayrollWorkflowService.getPeriodById(periodId);
  }

  static async getRequiredProfessionCodes(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    return PayrollReviewService.getRequiredProfessionCodes(periodId, conn);
  }

  static async getReviewedProfessionCodes(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    return PayrollReviewService.getReviewedProfessionCodes(periodId, conn);
  }

  static async getPeriodReviewProgress(periodId: number, role?: string | null) {
    return PayrollReviewService.getPeriodReviewProgress(periodId, role);
  }

  static async setPeriodProfessionReview(
    periodId: number,
    professionCode: string,
    reviewed: boolean,
    actorId: number,
  ) {
    return PayrollReviewService.setPeriodProfessionReview(
      periodId,
      professionCode,
      reviewed,
      actorId,
    );
  }

  static async getAllPeriods(role?: string | null): Promise<PayPeriod[]> {
    return PayrollWorkflowService.getAllPeriods(role);
  }

  static async ensureCurrentPeriod(): Promise<void> {
    return PayrollWorkflowService.ensureCurrentPeriod();
  }

  static async getPeriodDetail(periodId: number, role?: string | null) {
    return PayrollWorkflowService.getPeriodDetail(periodId, role);
  }

  static async addPeriodItems(
    periodId: number,
    requestIds: number[],
    actorId?: number,
  ) {
    return PayrollPeriodItemService.addPeriodItems(periodId, requestIds, actorId);
  }

  static async removePeriodItem(
    periodId: number,
    itemId: number,
    actorId?: number,
  ) {
    return PayrollPeriodItemService.removePeriodItem(periodId, itemId, actorId);
  }
}

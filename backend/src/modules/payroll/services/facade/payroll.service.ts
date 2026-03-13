/**
 * payroll module - facade service
 */
import { PoolConnection } from "mysql2/promise";
import { LeaveManagementPeriodQuery } from "@/modules/leave-management/repositories/leave-management.repository.js";
import {
  PayPeriod,
  PeriodStatus,
} from "@/modules/payroll/entities/payroll.entity.js";
import { PayrollPeriodService } from "@/modules/payroll/services/facade/payroll-period.service.js";
import { PayrollPeriodLeaveService } from "@/modules/payroll/services/facade/payroll-period-leave.service.js";
import { PayrollCalculationService } from "@/modules/payroll/services/calculation/payroll-calculation.service.js";
import { PayrollPayoutService } from "@/modules/payroll/services/calculation/payroll-payout.service.js";

export { PeriodStatus } from "@/modules/payroll/entities/payroll.entity.js";

export class PayrollService {
  static canRoleViewPeriod(
    role: string | null | undefined,
    status: PeriodStatus | string,
  ): boolean {
    return PayrollPeriodService.canRoleViewPeriod(role, status);
  }

  static async ensurePeriodVisibleForRole(
    periodId: number,
    role: string | null | undefined,
  ): Promise<PayPeriod> {
    return PayrollPeriodService.ensurePeriodVisibleForRole(periodId, role);
  }

  static async getPeriodByMonthYear(
    year: number,
    month: number,
  ): Promise<PayPeriod | null> {
    return PayrollPeriodService.getPeriodByMonthYear(year, month);
  }

  static async getOrCreatePeriod(
    year: number,
    month: number,
    createdBy?: number | null,
  ): Promise<PayPeriod> {
    return PayrollPeriodService.getOrCreatePeriod(year, month, createdBy);
  }

  static async processPeriodCalculation(periodId: number) {
    return PayrollCalculationService.processPeriodCalculation(periodId);
  }

  static async updatePeriodStatus(
    periodId: number,
    action:
      | "SUBMIT"
      | "APPROVE_HR"
      | "APPROVE_HEAD_FINANCE"
      | "APPROVE_DIRECTOR"
      | "REJECT",
    actorId: number,
    reason?: string,
  ) {
    return PayrollPeriodService.updatePeriodStatus(
      periodId,
      action,
      actorId,
      reason,
    );
  }

  static async hardDeletePeriod(periodId: number, actorId: number) {
    return PayrollPeriodService.hardDeletePeriod(periodId, actorId);
  }

  static async getPeriodById(periodId: number) {
    return PayrollPeriodService.getPeriodById(periodId);
  }

  static async getRequiredProfessionCodes(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    return PayrollPeriodService.getRequiredProfessionCodes(periodId, conn);
  }

  static async getReviewedProfessionCodes(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    return PayrollPeriodService.getReviewedProfessionCodes(periodId, conn);
  }

  static async getPeriodReviewProgress(periodId: number, role?: string | null) {
    return PayrollPeriodService.getPeriodReviewProgress(periodId, role);
  }

  static async setPeriodProfessionReview(
    periodId: number,
    professionCode: string,
    reviewed: boolean,
    actorId: number,
  ) {
    return PayrollPeriodService.setPeriodProfessionReview(
      periodId,
      professionCode,
      reviewed,
      actorId,
    );
  }

  static async getAllPeriods(role?: string | null): Promise<PayPeriod[]> {
    return PayrollPeriodService.getAllPeriods(role);
  }

  static async ensureCurrentPeriod(): Promise<void> {
    return PayrollPeriodService.ensureCurrentPeriod();
  }

  static async getPeriodDetail(periodId: number, role?: string | null) {
    return PayrollPeriodService.getPeriodDetail(periodId, role);
  }

  static async addPeriodItems(
    periodId: number,
    requestIds: number[],
    actorId?: number,
  ) {
    return PayrollPeriodService.addPeriodItems(periodId, requestIds, actorId);
  }

  static async removePeriodItem(
    periodId: number,
    itemId: number,
    actorId?: number,
  ) {
    return PayrollPeriodService.removePeriodItem(periodId, itemId, actorId);
  }

  static async searchPayouts(params: {
    q: string;
    periodYear?: number;
    periodMonth?: number;
    role?: string | null;
  }) {
    return PayrollPayoutService.searchPayouts(params);
  }

  static async getPeriodPayouts(periodId: number) {
    return PayrollPayoutService.getPeriodPayouts(periodId);
  }

  static async getPayoutDetail(
    payoutId: number,
    role?: string | null,
  ) {
    return PayrollPayoutService.getPayoutDetail(payoutId, role);
  }

  static async updatePayout(
    payoutId: number,
    payload: {
      eligible_days?: number;
      deducted_days?: number;
      retroactive_amount?: number;
      remark?: string | null;
    },
    meta?: { actorId?: number | null },
  ) {
    return PayrollPayoutService.updatePayout(payoutId, payload, meta);
  }

  static async getPeriodSummaryByProfession(periodId: number) {
    return PayrollPayoutService.getPeriodSummaryByProfession(periodId);
  }

  static async getPeriodLeaves(
    periodId: number,
    params: Pick<
      LeaveManagementPeriodQuery,
      | "leave_type"
      | "profession_code"
      | "pending_report"
      | "search"
      | "limit"
      | "offset"
      | "sort_by"
      | "sort_dir"
    >,
  ) {
    return PayrollPeriodLeaveService.listPeriodLeaves(periodId, params);
  }

  static async getPeriodLeaveProfessionSummary(
    periodId: number,
    params: Pick<
      LeaveManagementPeriodQuery,
      "leave_type" | "pending_report" | "search"
    >,
  ) {
    return PayrollPeriodLeaveService.summarizePeriodLeavesByProfession(periodId, params);
  }

  static async calculateOnDemand(
    year: number,
    month: number,
    citizenId: string,
  ) {
    return PayrollCalculationService.calculateOnDemand(year, month, citizenId);
  }
}

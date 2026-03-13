import { PoolConnection } from "mysql2/promise";
import { PeriodStatus } from "@/modules/payroll/entities/payroll.entity.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";
import { normalizeProfessionCodeForReview } from "@/modules/payroll/services/shared/payroll.utils.js";
import { PayrollWorkflowService } from "@/modules/payroll/services/workflow/payroll-workflow.service.js";

export class PayrollReviewService {
  static async getRequiredProfessionCodes(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    const rawCodes =
      await PayrollRepository.findRequiredProfessionCodesByPeriod(
        periodId,
        conn,
      );
    return Array.from(
      new Set(
        rawCodes
          .map((code) => normalizeProfessionCodeForReview(code))
          .filter(Boolean),
      ),
    );
  }

  static async getReviewedProfessionCodes(
    periodId: number,
    conn?: PoolConnection,
  ): Promise<string[]> {
    const rawCodes =
      await PayrollRepository.findReviewedProfessionCodesByPeriod(
        periodId,
        conn,
      );
    return Array.from(
      new Set(
        rawCodes
          .map((code) => normalizeProfessionCodeForReview(code))
          .filter(Boolean),
      ),
    );
  }

  static async getPeriodReviewProgress(periodId: number, role?: string | null) {
    await PayrollWorkflowService.ensurePeriodVisibleForRole(periodId, role);

    const requiredProfessionCodes =
      await PayrollReviewService.getRequiredProfessionCodes(periodId);
    const reviewedProfessionCodes =
      await PayrollReviewService.getReviewedProfessionCodes(periodId);
    const reviewedSet = new Set(reviewedProfessionCodes);
    const missingProfessionCodes = requiredProfessionCodes.filter(
      (code) => !reviewedSet.has(code),
    );

    return {
      required_profession_codes: requiredProfessionCodes,
      reviewed_profession_codes: reviewedProfessionCodes.filter((code) =>
        requiredProfessionCodes.includes(code),
      ),
      missing_profession_codes: missingProfessionCodes,
      total_required: requiredProfessionCodes.length,
      total_reviewed: requiredProfessionCodes.filter((code) =>
        reviewedSet.has(code),
      ).length,
      all_reviewed:
        requiredProfessionCodes.length > 0 &&
        missingProfessionCodes.length === 0,
    };
  }

  static async setPeriodProfessionReview(
    periodId: number,
    professionCode: string,
    reviewed: boolean,
    actorId: number,
  ) {
    const period = await PayrollRepository.findPeriodById(periodId);
    if (!period) throw new Error("Period not found");
    if (period.status !== PeriodStatus.OPEN) {
      throw new Error("สามารถยืนยันตรวจได้เฉพาะรอบที่ยังเปิดอยู่");
    }

    const normalizedCode = normalizeProfessionCodeForReview(professionCode);
    if (!normalizedCode) {
      throw new Error("profession_code is required");
    }

    const requiredProfessionCodes =
      await PayrollReviewService.getRequiredProfessionCodes(periodId);
    if (!requiredProfessionCodes.includes(normalizedCode)) {
      throw new Error("วิชาชีพนี้ไม่มีในรอบการคำนวณปัจจุบัน");
    }

    await PayrollRepository.setProfessionReview(
      periodId,
      normalizedCode,
      reviewed,
      actorId,
    );
    return PayrollReviewService.getPeriodReviewProgress(periodId);
  }
}

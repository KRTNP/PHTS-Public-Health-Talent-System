import { PoolConnection } from "mysql2/promise";
import { payrollService as calculator } from "@/modules/payroll/core/calculator/facade/calculator.js";
import { calculateRetroactive } from "@/modules/payroll/core/retroactive/retroactive.js";
import { PeriodStatus } from "@/modules/payroll/entities/payroll.entity.js";
import { PayrollRepository } from "@/modules/payroll/repositories/payroll.repository.js";
import { isPeriodLocked } from "@/modules/payroll/services/shared/payroll.utils.js";

export class PayrollCalculationService {
  private static async loadHolidayDates(
    year: number,
    conn: PoolConnection,
  ): Promise<string[]> {
    const holidayRows = await PayrollRepository.findHolidays(year - 1, year, conn);
    return holidayRows.map((h: any) => calculator.formatLocalDate(h.holiday_date));
  }

  private static applyRetroDeductCheck(
    currentResult: any,
    retroDetails: any[] | undefined,
  ): void {
    if (!retroDetails || retroDetails.length === 0) return;
    const negative = retroDetails.filter((detail) => detail.diff < -0.01);
    if (negative.length === 0) return;
    const total = Math.abs(
      negative.reduce((sum, item) => sum + item.diff, 0),
    );
    const checks = currentResult.checks ?? [];
    checks.push({
      code: "RETRO_DEDUCT",
      severity: "WARNING",
      title: "ตกเบิกย้อนหลัง (หัก)",
      summary: `มีตกเบิกย้อนหลังติดลบ ${total.toLocaleString("th-TH")} บาท`,
      impactDays: 0,
      impactAmount: Number.parseFloat(total.toFixed(2)),
      startDate: null,
      endDate: null,
      evidence: negative.map((detail) => ({
        type: "retro",
        reference_month: detail.month,
        reference_year: detail.year,
        diff: detail.diff,
        remark: detail.remark,
      })),
    });
    currentResult.checks = checks;
  }

  private static buildReturnReportMap(leaveRows: any[], returnReportRows: any[]) {
    const leaveIdToCitizen = new Map<number, string>();
    leaveRows.forEach((row) => {
      if (row.id) leaveIdToCitizen.set(row.id, row.citizen_id);
    });
    const returnReportMap = new Map<string, any[]>();
    returnReportRows.forEach((row) => {
      const citizenId = leaveIdToCitizen.get(row.leave_record_id);
      if (!citizenId) return;
      let reportRows = returnReportMap.get(citizenId);
      if (!reportRows) {
        reportRows = [];
        returnReportMap.set(citizenId, reportRows);
      }
      reportRows.push(row);
    });
    return returnReportMap;
  }

  private static async processCitizenChunk(
    conn: PoolConnection,
    params: {
      year: number;
      month: number;
      periodId: number;
      citizenIds: string[];
      holidays: string[];
    },
  ): Promise<{ totalAmount: number; headCount: number }> {
    const { year, month, periodId, citizenIds, holidays } = params;
    const userIdMap = await PayrollRepository.findUserIdMapByCitizenIds(
      citizenIds,
      conn,
    );
    const startOfMonth = calculator.makeLocalDate(year, month - 1, 1);
    const endOfMonth = calculator.makeLocalDate(year, month, 0);
    const fiscalYear = month >= 10 ? year + 1 + 543 : year + 543;

    const batchData = await PayrollRepository.fetchBatchData(
      citizenIds,
      startOfMonth,
      endOfMonth,
      fiscalYear,
      conn,
    );
    const eligMap = buildGroupMap(batchData.eligibilityRows, (row) => {
      if (!row.expiry_date && row.expiry_date_alt) row.expiry_date = row.expiry_date_alt;
    });
    const moveMap = buildGroupMap(batchData.movementRows);
    const empMap = buildSingleMap(batchData.employeeRows);
    const licMap = buildGroupMap(batchData.licenseRows);
    const leaveMap = buildGroupMap(batchData.leaveRows);
    const quotaMap = buildSingleMap(batchData.quotaRows);
    const noSalaryMap = buildGroupMap(batchData.noSalaryRows);
    const returnReportMap = PayrollCalculationService.buildReturnReportMap(
      batchData.leaveRows as any[],
      batchData.returnReportRows as any[],
    );

    let totalAmount = 0;
    let headCount = 0;
    for (const cid of citizenIds) {
      const employeeData = {
        eligibilityRows: eligMap.get(cid) || [],
        movementRows: moveMap.get(cid) || [],
        employeeRow: empMap.get(cid) || {},
        licenseRows: licMap.get(cid) || [],
        leaveRows: leaveMap.get(cid) || [],
        quotaRow: quotaMap.get(cid) || null,
        holidays,
        noSalaryPeriods: noSalaryMap.get(cid) || [],
        returnReportRows: returnReportMap.get(cid) || [],
      };
      const currentResult = await calculator.calculateMonthlyWithData(
        year,
        month,
        employeeData,
      );
      const retroResult = await calculateRetroactive(
        cid,
        year,
        month,
        6,
        conn as any,
      );

      currentResult.retroactiveTotal = retroResult.totalRetro;
      currentResult.retroDetails = retroResult.retroDetails;
      PayrollCalculationService.applyRetroDeductCheck(
        currentResult,
        retroResult.retroDetails as any[] | undefined,
      );

      const grandTotal = currentResult.netPayment + (currentResult.retroactiveTotal || 0);
      if (grandTotal <= 0 && currentResult.netPayment <= 0) {
        continue;
      }
      await calculator.savePayout({
        conn,
        periodId,
        userId: userIdMap.get(cid) ?? null,
        citizenId: cid,
        result: currentResult,
        masterRateId: currentResult.masterRateId,
        baseRateSnapshot: currentResult.rateSnapshot,
        referenceYear: year,
        referenceMonth: month,
      });
      totalAmount += grandTotal;
      headCount += 1;
    }

    return { totalAmount, headCount };
  }

  static async processPeriodCalculation(periodId: number) {
    const conn = await PayrollRepository.getConnection();
    try {
      await conn.beginTransaction();

      const period = await PayrollRepository.findPeriodByIdForUpdate(
        periodId,
        conn,
      );
      if (!period) throw new Error("Period not found");
      if (period.status !== PeriodStatus.OPEN || isPeriodLocked(period)) {
        throw new Error(
          "ไม่สามารถคำนวณได้เนื่องจากงวดเดือนไม่ได้อยู่ในสถานะ OPEN",
        );
      }

      const { period_year: year, period_month: month } = period;

      await PayrollRepository.deletePayResultChecksByPeriod(periodId, conn);
      await PayrollRepository.deletePayResultItemsByPeriod(periodId, conn);
      await PayrollRepository.deletePayResultsByPeriod(periodId, conn);

      const periodItemCitizenIds =
        await PayrollRepository.findPeriodItemCitizenIds(periodId, conn);

      const holidays = await PayrollCalculationService.loadHolidayDates(year, conn);

      const eligibleCitizenIds =
        periodItemCitizenIds.length > 0
          ? Array.from(new Set(periodItemCitizenIds))
          : await PayrollRepository.findEligibleCitizenIds(year, month, conn);

      let totalAmount = 0;
      let headCount = 0;

      const CHUNK_SIZE = 200;
      for (let i = 0; i < eligibleCitizenIds.length; i += CHUNK_SIZE) {
        const citizenIds = eligibleCitizenIds.slice(i, i + CHUNK_SIZE);
        if (citizenIds.length === 0) continue;
        const chunkResult = await PayrollCalculationService.processCitizenChunk(conn, {
          year,
          month,
          periodId,
          citizenIds,
          holidays,
        });
        totalAmount += chunkResult.totalAmount;
        headCount += chunkResult.headCount;
      }

      await PayrollRepository.updatePeriodTotals(
        periodId,
        totalAmount,
        headCount,
        conn,
      );
      await PayrollRepository.clearProfessionReviewsByPeriod(periodId, conn);

      await conn.commit();
      return { success: true, headCount, totalAmount };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  static async calculateOnDemand(
    year: number,
    month: number,
    citizenId: string,
  ) {
    const conn = await PayrollRepository.getConnection();
    try {
      const currentResult = await calculator.calculateMonthly(
        citizenId,
        year,
        month,
        conn as any,
      );
      const retroResult = await calculateRetroactive(
        citizenId,
        year,
        month,
        6,
        conn as any,
      );

      const retroTotal = retroResult.totalRetro || 0;
      const total_payable = Number(
        (currentResult.netPayment + retroTotal).toFixed(2),
      );

      return [
        {
          ...currentResult,
          retroactiveTotal: retroTotal,
          retroDetails: retroResult.retroDetails,
          total_payable,
        },
      ];
    } finally {
      conn.release();
    }
  }
}

function buildGroupMap(
  rows: any[],
  transform?: (row: any) => void,
): Map<string, any[]> {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    transform?.(row);
    const key = row.citizen_id;
    let group = map.get(key);
    if (!group) {
      group = [];
      map.set(key, group);
    }
    group.push(row);
  }
  return map;
}

function buildSingleMap(rows: any[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const row of rows) {
    map.set(row.citizen_id, row);
  }
  return map;
}

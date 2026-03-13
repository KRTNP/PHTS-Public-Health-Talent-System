import { PoolConnection, ResultSetHeader } from "mysql2/promise";
import type {
  CalculationResult,
  PayrollCheck,
} from "@/modules/payroll/core/calculator/facade/calculator.js";

export type SavePayoutInput = {
  conn: PoolConnection;
  periodId: number;
  userId: number | null;
  citizenId: string;
  result: CalculationResult;
  masterRateId: number | null;
  baseRateSnapshot: number;
  referenceYear: number;
  referenceMonth: number;
};

const insertCurrentPayoutItem = async (
  conn: PoolConnection,
  payoutId: number,
  referenceMonth: number,
  referenceYear: number,
  netPayment: number,
): Promise<void> => {
  if (netPayment === 0) return;
  await conn.query(
    `
      INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
      VALUES (?, ?, ?, 'CURRENT', ?, 'ค่าตอบแทนงวดปัจจุบัน')
    `,
    [payoutId, referenceMonth, referenceYear, netPayment],
  );
};

const resolveRetroItemType = (value: number): "RETROACTIVE_ADD" | "RETROACTIVE_DEDUCT" => {
  return value > 0 ? "RETROACTIVE_ADD" : "RETROACTIVE_DEDUCT";
};

const insertRetroPayoutItems = async (
  conn: PoolConnection,
  payoutId: number,
  result: CalculationResult,
): Promise<void> => {
  if (result.retroDetails && result.retroDetails.length > 0) {
    for (const detail of result.retroDetails) {
      await conn.query(
        `
          INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          payoutId,
          detail.month,
          detail.year,
          resolveRetroItemType(detail.diff),
          Math.abs(detail.diff),
          detail.remark,
        ],
      );
    }
    return;
  }

  if (!result.retroactiveTotal || Math.abs(result.retroactiveTotal) <= 0.01) return;
  await conn.query(
    `
      INSERT INTO pay_result_items (payout_id, reference_month, reference_year, item_type, amount, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      payoutId,
      0,
      0,
      resolveRetroItemType(result.retroactiveTotal),
      Math.abs(result.retroactiveTotal),
      "ปรับตกเบิกย้อนหลัง (รวมยอด)",
    ],
  );
};

const insertPayoutChecks = async (
  conn: PoolConnection,
  payoutId: number,
  checks: PayrollCheck[] | undefined,
): Promise<void> => {
  if (!checks || checks.length === 0) return;
  for (const check of checks) {
    await conn.query(
      `
        INSERT INTO pay_result_checks
        (payout_id, code, severity, title, summary, impact_days, impact_amount, start_date, end_date, evidence_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        payoutId,
        check.code,
        check.severity,
        check.title,
        check.summary,
        check.impactDays,
        check.impactAmount,
        check.startDate,
        check.endDate,
        check.evidence.length ? JSON.stringify(check.evidence) : null,
      ],
    );
  }
};

export async function savePayout({
  conn,
  periodId,
  userId,
  citizenId,
  result,
  masterRateId,
  baseRateSnapshot,
  referenceYear,
  referenceMonth,
}: SavePayoutInput): Promise<number> {
  const totalPayable = result.netPayment + (result.retroactiveTotal ?? 0);

  const [res] = await conn.query<ResultSetHeader>(
    `
      INSERT INTO pay_results
      (period_id, user_id, citizen_id, master_rate_id, profession_code, pts_rate_snapshot, calculated_amount, retroactive_amount, total_payable, deducted_days, eligible_days, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      periodId,
      userId,
      citizenId,
      masterRateId,
      result.professionCode ?? null,
      baseRateSnapshot,
      result.netPayment,
      result.retroactiveTotal ?? 0,
      totalPayable,
      result.totalDeductionDays,
      result.eligibleDays,
      result.remark,
    ],
  );

  const payoutId = res.insertId;
  await insertCurrentPayoutItem(conn, payoutId, referenceMonth, referenceYear, result.netPayment);
  await insertRetroPayoutItems(conn, payoutId, result);
  await insertPayoutChecks(conn, payoutId, result.checks);

  return payoutId;
}

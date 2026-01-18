import { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '../../../config/database.js';
import { calculateMonthly, RetroDetail } from './calculator.js';

export async function calculateRetroactive(
  citizenId: string,
  currentYear: number,
  currentMonth: number,
  lookBackMonths = 6,
  connection?: PoolConnection,
): Promise<{ totalRetro: number; retroDetails: RetroDetail[] }> {
  let totalRetro = 0;
  const retroDetails: RetroDetail[] = [];

  for (let i = 1; i <= lookBackMonths; i++) {
    let targetMonth = currentMonth - i;
    let targetYear = currentYear;
    if (targetMonth <= 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    const dbConn: Pick<PoolConnection, 'query'> = connection ?? pool;

    const [periodRows] = await dbConn.query<RowDataPacket[]>(
      `SELECT period_id, status FROM pay_periods WHERE period_month = ? AND period_year = ?`,
      [targetMonth, targetYear],
    );
    if (!Array.isArray(periodRows) || periodRows.length === 0) continue;
    const period = periodRows[0] as any;
    if (period.status && period.status !== 'CLOSED') continue;

    const [payoutRows] = await dbConn.query<RowDataPacket[]>(
      `SELECT calculated_amount FROM pay_results WHERE citizen_id = ? AND period_id = ?`,
      [citizenId, period.period_id],
    );
    const originalPaid = payoutRows.length ? Number((payoutRows[0] as any).calculated_amount) : 0;

    const [adjustmentRows] = await dbConn.query<RowDataPacket[]>(
      `
        SELECT pi.item_type, pi.amount
        FROM pay_result_items pi
        JOIN pay_results p ON pi.payout_id = p.payout_id
        WHERE p.citizen_id = ?
          AND pi.reference_month = ?
          AND pi.reference_year = ?
          AND pi.item_type IN ('RETROACTIVE_ADD', 'RETROACTIVE_DEDUCT')
      `,
      [citizenId, targetMonth, targetYear],
    );

    let historicalAdjustment = 0;
    if (Array.isArray(adjustmentRows)) {
      for (const adj of adjustmentRows as any[]) {
        if (adj.item_type === 'RETROACTIVE_ADD') {
          historicalAdjustment += Number(adj.amount);
        } else if (adj.item_type === 'RETROACTIVE_DEDUCT') {
          historicalAdjustment -= Number(adj.amount);
        }
      }
    }

    const paidAmount = originalPaid + historicalAdjustment;

    const recalculated = await calculateMonthly(
      citizenId,
      targetYear,
      targetMonth,
      connection,
    );
    const shouldBeAmount = recalculated.netPayment;

    const diff = parseFloat((shouldBeAmount - paidAmount).toFixed(2));
    if (Math.abs(diff) > 0.01) {
      totalRetro += diff;
      retroDetails.push({
        month: targetMonth,
        year: targetYear,
        diff,
        remark: `ปรับปรุงยอดเดือน ${targetMonth}/${targetYear}`,
      });
    }
  }

  return { totalRetro: parseFloat(totalRetro.toFixed(2)), retroDetails };
}

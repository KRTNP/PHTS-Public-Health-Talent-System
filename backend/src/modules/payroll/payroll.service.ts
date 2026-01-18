import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import db from '../../config/database.js';
import { NotificationService } from '../notification/notification.service.js';
import { payrollService as calculator } from './core/calculator.js';
import { calculateRetroactive } from './core/retroactive.js';

export enum PeriodStatus {
  OPEN = 'OPEN',
  WAITING_HR = 'WAITING_HR',
  WAITING_HEAD_FINANCE = 'WAITING_HEAD_FINANCE',
  WAITING_DIRECTOR = 'WAITING_DIRECTOR',
  CLOSED = 'CLOSED',
}

interface PeriodSummary {
  period_id: number;
  period_month: number;
  period_year: number;
  status: PeriodStatus;
  total_amount: number;
  total_headcount: number;
  created_at: Date;
}

export class PayrollService {
  /**
   * Initialize or fetch a period; creates new row with OPEN status if missing.
   */
  static async getOrCreatePeriod(year: number, month: number): Promise<PeriodSummary> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM pay_periods WHERE period_month = ? AND period_year = ?',
      [month, year],
    );

    if (rows.length > 0) {
      return rows[0] as PeriodSummary;
    }

    const [res] = await db.execute<ResultSetHeader>(
      'INSERT INTO pay_periods (period_month, period_year, status) VALUES (?, ?, ?)',
      [month, year, PeriodStatus.OPEN],
    );

    const [newRows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM pay_periods WHERE period_id = ?',
      [res.insertId],
    );
    return newRows[0] as PeriodSummary;
  }

  /**
   * Run payroll calculation for a period (re-run safe).
   */
  static async processPeriodCalculation(periodId: number) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

    const [period] = await conn.query<RowDataPacket[]>(
      'SELECT * FROM pay_periods WHERE period_id = ? FOR UPDATE',
      [periodId],
    );

      if (!period.length) throw new Error('Period not found');
      if (period[0].status !== PeriodStatus.OPEN) {
        throw new Error('ไม่สามารถคำนวณได้เนื่องจากงวดเดือนไม่ได้อยู่ในสถานะ OPEN');
      }

      const year = period[0].period_year;
      const month = period[0].period_month;

      await conn.execute('DELETE FROM pay_results WHERE period_id = ?', [periodId]);

      const [eligibleUsers] = await conn.query<RowDataPacket[]>(
        `
        SELECT DISTINCT citizen_id FROM req_eligibility 
        WHERE is_active = 1 
        AND effective_date <= LAST_DAY(STR_TO_DATE(CONCAT(?, '-', ?, '-01'), '%Y-%m-%d'))
      `,
        [year, month],
      );

      let totalAmount = 0;
      let headCount = 0;

      for (const user of eligibleUsers) {
        const citizenId = user.citizen_id;

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

        currentResult.retroactiveTotal = retroResult.totalRetro;
        currentResult.retroDetails = retroResult.retroDetails;

        const grandTotal = currentResult.netPayment + (currentResult.retroactiveTotal || 0);

        if (grandTotal > 0 || currentResult.netPayment > 0) {
          await calculator.savePayout({
            conn,
            periodId,
            citizenId,
            result: currentResult,
            masterRateId: currentResult.masterRateId,
            baseRateSnapshot: currentResult.rateSnapshot,
            referenceYear: year,
            referenceMonth: month,
          });

          totalAmount += grandTotal;
          headCount++;
        }
      }

      await conn.execute(
        'UPDATE pay_periods SET total_amount = ?, total_headcount = ?, created_at = NOW() WHERE period_id = ?',
        [totalAmount, headCount, periodId],
      );

      await conn.commit();
      return { success: true, headCount, totalAmount };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Transition period status through workflow.
   */
  static async updatePeriodStatus(
    periodId: number,
    action: 'SUBMIT' | 'APPROVE_HR' | 'APPROVE_HEAD_FINANCE' | 'APPROVE_DIRECTOR' | 'REJECT',
    _actorId: number,
  ) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM pay_periods WHERE period_id = ? FOR UPDATE',
        [periodId],
      );
      if (!rows.length) throw new Error('Period not found');

      const currentStatus = rows[0].status;
      const year = rows[0].period_year;
      const month = rows[0].period_month;
      let nextStatus: PeriodStatus | null = null;

      if (action === 'SUBMIT' && currentStatus === PeriodStatus.OPEN) {
        nextStatus = PeriodStatus.WAITING_HR;
        await NotificationService.notifyRole(
          'HEAD_HR',
          'ตรวจสอบงวดเดือน',
          `งวดเดือน ${month}/${year} รอการตรวจสอบจากท่าน`,
        );
      } else if (action === 'APPROVE_HR' && currentStatus === PeriodStatus.WAITING_HR) {
        nextStatus = PeriodStatus.WAITING_HEAD_FINANCE;
        await NotificationService.notifyRole(
          'HEAD_FINANCE',
          'ตรวจสอบงวดเดือน',
          `งวดเดือน ${month}/${year} ผ่านการตรวจสอบจาก HR แล้ว รอท่านอนุมัติ`,
        );
      } else if (
        action === 'APPROVE_HEAD_FINANCE' &&
        currentStatus === PeriodStatus.WAITING_HEAD_FINANCE
      ) {
        nextStatus = PeriodStatus.WAITING_DIRECTOR;
        await NotificationService.notifyRole(
          'DIRECTOR',
          'อนุมัติปิดงวดเดือน',
          `สรุปยอดงวดเดือน ${month}/${year} รอการอนุมัติปิดงวด`,
        );
      } else if (action === 'APPROVE_DIRECTOR' && currentStatus === PeriodStatus.WAITING_DIRECTOR) {
        nextStatus = PeriodStatus.CLOSED;
        await NotificationService.notifyRole(
          'FINANCE_OFFICER',
          'งวดเดือนปิดแล้ว',
          `งวดเดือน ${month}/${year} อนุมัติแล้ว สามารถดาวน์โหลดรายงานได้`,
        );
      } else if (action === 'REJECT') {
        nextStatus = PeriodStatus.OPEN;
      } else {
        throw new Error(`Invalid action '${action}' for status '${currentStatus}'`);
      }

      let sql = 'UPDATE pay_periods SET status = ?';
      const params: any[] = [nextStatus];

      if (nextStatus === PeriodStatus.CLOSED) {
        sql += ', closed_at = NOW()';
      }

      sql += ' WHERE period_id = ?';
      params.push(periodId);

      await conn.execute(sql, params);

      await conn.commit();
      return { success: true, status: nextStatus };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Fetch period summary by id.
   */
  static async getPeriodById(periodId: number) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM pay_periods WHERE period_id = ?',
      [periodId],
    );
    return rows[0] || null;
  }

  /**
   * List all periods (newest first).
   */
  static async getAllPeriods(): Promise<PeriodSummary[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT * FROM pay_periods ORDER BY period_year DESC, period_month DESC',
    );
    return rows as PeriodSummary[];
  }

  /**
   * List payouts for a specific period (for officer review UI).
   */
  static async getPeriodPayouts(periodId: number) {
    const [rows] = await db.query<RowDataPacket[]>(
      `
      SELECT
        p.payout_id,
        p.citizen_id,
        e.first_name,
        e.last_name,
        e.position_name,
        p.eligible_days,
        p.deducted_days,
        p.pts_rate_snapshot as rate,
        p.total_payable,
        p.remark
      FROM pay_results p
      LEFT JOIN emp_profiles e ON e.citizen_id = p.citizen_id
      WHERE p.period_id = ?
      ORDER BY e.first_name ASC, e.last_name ASC, p.citizen_id ASC
      `,
      [periodId],
    );
    return rows;
  }

  /**
   * On-demand calculation for a single employee (no persistence).
   */
  static async calculateOnDemand(year: number, month: number, citizenId: string) {
    const conn = await db.getConnection();
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
      const total_payable = Number((currentResult.netPayment + retroTotal).toFixed(2));

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

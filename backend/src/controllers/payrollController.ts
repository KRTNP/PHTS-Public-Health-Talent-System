import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import pool, { getConnection } from '../config/database.js';
import { payrollService, CalculationResult } from '../services/payrollService.js';

interface PeriodRow extends RowDataPacket {
  period_id: number;
  period_year: number;
  period_month: number;
  status: string;
}

interface EmployeeRow extends RowDataPacket {
  citizen_id: string;
}

export const payrollController = {
  // API: สั่งคำนวณเงิน (รายคน หรือ ทั้งหมด)
  // POST /api/payroll/calculate
  // Body: { year: 2024, month: 4, citizen_id?: "..." }
  calculatePayroll: async (req: Request, res: Response): Promise<Response> => {
    const conn = await getConnection();
    try {
      const { year, month, citizen_id } = req.body ?? {};
      const yearNum = Number(year);
      const monthNum = Number(month);

      if (!yearNum || !monthNum) {
        return res
          .status(400)
          .json({ error: 'กรุณาระบุปี (year) และเดือน (month)' });
      }
      if (monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ error: 'รูปแบบเดือนไม่ถูกต้อง' });
      }
      if (citizen_id !== undefined && typeof citizen_id !== 'string') {
        return res.status(400).json({ error: 'citizen_id ต้องเป็น string' });
      }

      await conn.beginTransaction();

      // 1) ตรวจสอบ/สร้างงวดเดือน (Period)
      const [periodRows] = await conn.query<PeriodRow[]>(
        `SELECT period_id, status FROM pts_periods WHERE period_year = ? AND period_month = ? FOR UPDATE`,
        [yearNum, monthNum]
      );

      let periodId: number;
      if (periodRows.length === 0) {
        const [insertRes] = await conn.query<ResultSetHeader>(
          `INSERT INTO pts_periods (period_year, period_month, status) VALUES (?, ?, 'OPEN')`,
          [yearNum, monthNum]
        );
        periodId = insertRes.insertId;
      } else {
        const period = periodRows[0];
        if (period.status === 'CLOSED') {
          throw new Error('งวดเดือนนี้ถูกปิดไปแล้ว ไม่สามารถคำนวณใหม่ได้');
        }
        periodId = period.period_id;
      }

      // 2) หาเป้าหมายที่จะคำนวณ (Target Employees)
      let targets: string[] = [];
      if (citizen_id) {
        targets = [String(citizen_id)];
      } else {
        const [empRows] = await conn.query<EmployeeRow[]>(
          `SELECT citizen_id FROM pts_employees`
        );
        targets = empRows.map((r) => r.citizen_id);
      }

      // 3) เริ่ม Loop คำนวณ
      const results: Array<{ citizen_id: string; total_payable: number } & CalculationResult> = [];

      for (const cid of targets) {
        await conn.query(
          `DELETE FROM pts_payouts WHERE period_id = ? AND citizen_id = ?`,
          [periodId, cid]
        );

        const calcResult = await payrollService.calculateMonthly(cid, yearNum, monthNum);
        const retroResult = await payrollService.calculateRetroactive(cid, yearNum, monthNum);
        const finalResult: CalculationResult = {
          ...calcResult,
          retroactiveTotal: retroResult.totalRetro,
          retroDetails: retroResult.retroDetails,
        };

        await payrollService.savePayout(
          conn,
          periodId,
          cid,
          finalResult,
          finalResult.masterRateId,
          finalResult.rateSnapshot ?? 0,
          yearNum,
          monthNum
        );

        const sumPayable = parseFloat(
          (finalResult.netPayment + (finalResult.retroactiveTotal ?? 0)).toFixed(2)
        );

        results.push({
          citizen_id: cid,
          total_payable: sumPayable,
          ...finalResult,
        });
      }

      // 4) อัปเดตยอดรวมในตาราง Period
      await conn.query(
        `
        UPDATE pts_periods
        SET total_amount = (SELECT SUM(total_payable) FROM pts_payouts WHERE period_id = ?),
            total_headcount = (SELECT COUNT(*) FROM pts_payouts WHERE period_id = ?)
        WHERE period_id = ?
      `,
        [periodId, periodId, periodId]
      );

      await conn.commit();
      return res.json({
        success: true,
        message: `คำนวณเสร็จสิ้นสำหรับ ${targets.length} รายการ`,
        period_id: periodId,
        data: results,
      });
    } catch (error: any) {
      await conn.rollback();
      console.error('Payroll Calculation Error:', error);
      return res.status(500).json({ error: error.message });
    } finally {
      conn.release();
    }
  },

  // API: ดูภาพรวมงวดเดือน
  // GET /api/payroll/periods
  getPeriods: async (_req: Request, res: Response): Promise<Response> => {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM pts_periods ORDER BY period_year DESC, period_month DESC`
      );
      return res.json(rows);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },

  // API: ดูรายละเอียดการจ่ายเงินในงวดนั้น
  // GET /api/payroll/periods/:id/payouts
  getPayouts: async (req: Request, res: Response): Promise<Response> => {
    try {
      const periodId = req.params.id;
      const [rows] = await pool.query(
        `
        SELECT p.*, e.first_name, e.last_name, e.position_name 
        FROM pts_payouts p
        JOIN pts_employees e ON p.citizen_id = e.citizen_id
        WHERE p.period_id = ?
      `,
        [periodId]
      );
      return res.json(rows);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  },
};

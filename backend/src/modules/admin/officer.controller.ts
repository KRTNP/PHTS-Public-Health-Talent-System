import { Request, Response } from 'express';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { query } from '../../config/database.js';

// Holidays
export const getHolidays = async (req: Request, res: Response) => {
  try {
    const { year } = req.query;
    let sql = 'SELECT * FROM cfg_holidays';
    const params: any[] = [];

    if (year) {
      sql += ' WHERE YEAR(holiday_date) = ?';
      params.push(year);
    }
    sql += ' ORDER BY holiday_date DESC';

    const holidays = await query<RowDataPacket[]>(sql, params);
    res.json({ success: true, data: holidays });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const addHoliday = async (req: Request, res: Response) => {
  try {
    const { date, name } = req.body;
    await query<ResultSetHeader>(
      'INSERT INTO cfg_holidays (holiday_date, holiday_name, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE holiday_name = VALUES(holiday_name)',
      [date, name],
    );
    res.json({ success: true, message: 'Holiday saved successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteHoliday = async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    await query<ResultSetHeader>('DELETE FROM cfg_holidays WHERE holiday_date = ?', [date]);
    res.json({ success: true, message: 'Holiday deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Master Rates
export const getMasterRates = async (_req: Request, res: Response) => {
  try {
    const rates = await query<RowDataPacket[]>(
      'SELECT * FROM cfg_payment_rates ORDER BY profession_code, group_no, item_no',
    );
    res.json({ success: true, data: rates });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateMasterRate = async (req: Request, res: Response) => {
  try {
    const { rateId } = req.params;
    const { amount, condition_desc, is_active } = req.body;

    await query<ResultSetHeader>(
      'UPDATE cfg_payment_rates SET amount = ?, condition_desc = ?, is_active = ? WHERE rate_id = ?',
      [amount, condition_desc, is_active, rateId],
    );
    res.json({ success: true, message: 'Rate updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Leave adjustments
export const adjustLeaveRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { manual_start_date, manual_end_date, manual_duration_days, remark } = req.body;

    await query<ResultSetHeader>(
      `
      UPDATE leave_records 
      SET manual_start_date = ?, 
          manual_end_date = ?, 
          manual_duration_days = ?, 
          is_adjusted = 1,
          remark = CONCAT(COALESCE(remark, ''), ' [Edited by Officer: ', ?)
      WHERE id = ?
    `,
      [manual_start_date, manual_end_date, manual_duration_days, remark ?? '', id],
    );

    res.json({ success: true, message: 'Leave request adjusted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

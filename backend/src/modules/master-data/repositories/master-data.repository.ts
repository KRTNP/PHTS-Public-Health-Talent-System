import { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import db from "@config/database.js";

export class MasterDataRepository {
  static async hasHolidayTypeColumn(): Promise<boolean> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'cfg_holidays'
         AND COLUMN_NAME = 'holiday_type'
       LIMIT 1`,
    );
    return rows.length > 0;
  }

  static async findActiveHolidays(params: {
    year?: string | number;
    hasHolidayTypeColumn: boolean;
  }): Promise<RowDataPacket[]> {
    const { year, hasHolidayTypeColumn } = params;
    let sql = hasHolidayTypeColumn
      ? "SELECT holiday_date, holiday_name, is_active, holiday_type FROM cfg_holidays WHERE is_active = 1"
      : "SELECT holiday_date, holiday_name, is_active, NULL AS holiday_type FROM cfg_holidays WHERE is_active = 1";
    const queryParams: Array<string | number> = [];

    if (year) {
      sql += " AND YEAR(holiday_date) = ?";
      queryParams.push(year);
    }
    sql += " ORDER BY holiday_date DESC";

    const [rows] = await db.query<RowDataPacket[]>(sql, queryParams);
    return rows;
  }

  static async upsertHoliday(params: {
    date: string;
    name: string;
    type: string;
    hasHolidayTypeColumn: boolean;
  }): Promise<void> {
    const { date, name, type, hasHolidayTypeColumn } = params;
    if (hasHolidayTypeColumn) {
      await db.query<ResultSetHeader>(
        `INSERT INTO cfg_holidays (holiday_date, holiday_name, holiday_type, is_active)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           holiday_name = VALUES(holiday_name),
           holiday_type = VALUES(holiday_type),
           is_active = 1`,
        [date, name, type],
      );
      return;
    }

    await db.query<ResultSetHeader>(
      "INSERT INTO cfg_holidays (holiday_date, holiday_name, is_active) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE holiday_name = VALUES(holiday_name), is_active = 1",
      [date, name],
    );
  }

  static async updateHoliday(params: {
    originalDate: string;
    date: string;
    name: string;
    type: string;
    hasHolidayTypeColumn: boolean;
  }): Promise<void> {
    const { originalDate, date, name, type, hasHolidayTypeColumn } = params;
    if (hasHolidayTypeColumn) {
      await db.query<ResultSetHeader>(
        `UPDATE cfg_holidays
         SET holiday_date = ?, holiday_name = ?, holiday_type = ?, is_active = 1
         WHERE holiday_date = ? OR DATE(holiday_date) = ?`,
        [date, name, type, originalDate, originalDate],
      );
      return;
    }

    await db.query<ResultSetHeader>(
      `UPDATE cfg_holidays
       SET holiday_date = ?, holiday_name = ?, is_active = 1
       WHERE holiday_date = ? OR DATE(holiday_date) = ?`,
      [date, name, originalDate, originalDate],
    );
  }

  static async deactivateHoliday(date: string): Promise<void> {
    await db.query<ResultSetHeader>(
      "UPDATE cfg_holidays SET is_active = 0 WHERE holiday_date = ? OR DATE(holiday_date) = ?",
      [date, date],
    );
  }

  static async findMasterRatesWithEligibility(): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
         r.*,
         COALESCE(ec.eligible_count, 0) AS eligible_count
       FROM cfg_payment_rates r
       LEFT JOIN (
         SELECT master_rate_id, COUNT(*) AS eligible_count
         FROM req_eligibility
         WHERE is_active = 1
         GROUP BY master_rate_id
       ) ec ON ec.master_rate_id = r.rate_id
       ORDER BY r.profession_code, r.group_no, r.item_no`,
    );
    return rows;
  }

  static async updateMasterRate(params: {
    rateId: number;
    profession_code: string;
    group_no: number;
    item_no: string | null;
    sub_item_no: string | null;
    amount: number;
    condition_desc: string;
    detailed_desc: string;
    is_active: boolean;
  }): Promise<void> {
    const {
      rateId,
      profession_code,
      group_no,
      item_no,
      sub_item_no,
      amount,
      condition_desc,
      detailed_desc,
      is_active,
    } = params;
    await db.query<ResultSetHeader>(
      `UPDATE cfg_payment_rates
       SET profession_code = ?,
           group_no = ?,
           item_no = ?,
           sub_item_no = ?,
           amount = ?,
           condition_desc = ?,
           detailed_desc = ?,
           is_active = ?
       WHERE rate_id = ?`,
      [
        profession_code,
        group_no,
        item_no,
        sub_item_no,
        amount,
        condition_desc,
        detailed_desc,
        is_active ? 1 : 0,
        rateId,
      ],
    );
  }

  static async deactivateMasterRate(rateId: number): Promise<void> {
    await db.query<ResultSetHeader>(
      "UPDATE cfg_payment_rates SET is_active = ? WHERE rate_id = ?",
      [0, rateId],
    );
  }

  static async countMasterRateReferences(rateId: number): Promise<number> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
         (
           (SELECT COUNT(*) FROM req_eligibility WHERE master_rate_id = ?)
           +
           (SELECT COUNT(*) FROM pay_results WHERE master_rate_id = ?)
         ) AS ref_count`,
      [rateId, rateId],
    );
    return Number((rows[0] as any)?.ref_count ?? 0);
  }

  static async deleteMasterRatePermanently(rateId: number): Promise<void> {
    await db.query<ResultSetHeader>(
      "DELETE FROM cfg_payment_rates WHERE rate_id = ?",
      [rateId],
    );
  }

  static async createMasterRate(params: {
    profession_code: string;
    group_no: number;
    item_no: string | null;
    sub_item_no: string | null;
    amount: number;
    condition_desc: string;
    detailed_desc: string;
    is_active: number;
  }): Promise<number> {
    const {
      profession_code,
      group_no,
      item_no,
      sub_item_no,
      amount,
      condition_desc,
      detailed_desc,
      is_active,
    } = params;
    const [result] = await db.query<ResultSetHeader>(
      "INSERT INTO cfg_payment_rates (profession_code, group_no, item_no, sub_item_no, amount, condition_desc, detailed_desc, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        profession_code,
        group_no,
        item_no,
        sub_item_no,
        amount,
        condition_desc,
        detailed_desc,
        is_active,
      ],
    );
    return result.insertId;
  }

  static async findMasterRateById(rateId: number): Promise<RowDataPacket | null> {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM cfg_payment_rates WHERE rate_id = ?",
      [rateId],
    );
    return (rows[0] as RowDataPacket) ?? null;
  }

  static async findRatesByProfession(professionCode: string): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT rate_id, profession_code, group_no, item_no, sub_item_no, amount, condition_desc
       FROM cfg_payment_rates
       WHERE profession_code = ? AND is_active = 1
       ORDER BY group_no, item_no, sub_item_no`,
      [professionCode],
    );
    return rows;
  }

  static async findProfessions(): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT profession_code FROM cfg_payment_rates WHERE is_active = 1 ORDER BY profession_code`,
    );
    return rows;
  }

  static async findRateHierarchyRows(): Promise<RowDataPacket[]> {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
         rate_id, profession_code, group_no, item_no, sub_item_no, amount, condition_desc, detailed_desc
       FROM cfg_payment_rates
       WHERE is_active = 1
       ORDER BY
         CASE
           WHEN profession_code = 'DOCTOR' THEN 1
           WHEN profession_code = 'DENTIST' THEN 2
           WHEN profession_code = 'PHARMACIST' THEN 3
           WHEN profession_code = 'NURSE' THEN 4
           ELSE 5
         END,
         profession_code, group_no, item_no, sub_item_no`,
    );
    return rows;
  }
}

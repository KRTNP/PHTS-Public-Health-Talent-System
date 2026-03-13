/**
 * Report Module - Entity Definitions
 *
 * TypeScript interfaces for report generation
 */

// ─── Report Parameters ───────────────────────────────────────────────────────

export interface ReportParams {
  year: number;
  month: number;
  professionCode?: string;
  groupNo?: number;
}

// ─── Payout Data ─────────────────────────────────────────────────────────────

export interface PayoutRow {
  period_id: number;
  citizen_id: string;
  master_rate_id: number | null;
  title?: string | null;
  pts_rate_snapshot?: number;
  calculated_amount: number;
  retroactive_amount: number;
  total_payable: number;
  remark?: string | null;
  first_name?: string;
  last_name?: string;
  position_name?: string;
  base_rate?: number;
  group_no?: string | null;
  item_no?: string | null;
  profession_code?: string | null;
}

// ─── Master Rate ─────────────────────────────────────────────────────────────

export interface MasterRateRow {
  rate_id: number;
  amount: number;
  group_no: string | null;
  item_no: string | null;
  profession_code: string | null;
}

// ─── Report Data Row (after processing) ──────────────────────────────────────

export interface DetailReportRow {
  citizen_id: string;
  title: string;
  first_name: string;
  last_name: string;
  position_name: string;
  base_rate: number;
  current_receive: number;
  retro: number;
  total: number;
  remark: string;
  group_no: string | null;
  item_no: string | null;
  profession_code: string | null;
}

export interface SummaryReportRow {
  profession_code: string;
  sum_current: number;
  sum_retro: number;
  sum_total: number;
}

// ─── Period ──────────────────────────────────────────────────────────────────

export interface PayPeriod {
  period_id: number;
  period_year: number;
  period_month: number;
}

export interface PersonProfileRow {
  citizen_id: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
}

// ─── Profession Mapping ──────────────────────────────────────────────────────

export const PROFESSION_NAME_MAP: Record<string, string> = {
  DOCTOR: "แพทย์ + ผอ.รพ.",
  DENTIST: "ทันตแพทย์",
  PHARMACIST: "เภสัชกร",
  NURSE: "พยาบาลวิชาชีพ",
  MED_TECH: "นักเทคนิคการแพทย์",
  RAD_TECH: "นักรังสีการแพทย์",
  PHYSIO: "นักกายภาพบำบัด",
  OCC_THERAPY: "นักกิจกรรมบำบัด/นักอาชีวบำบัด",
  CLIN_PSY: "นักจิตวิทยาคลินิก",
  SPEECH_THERAPIST: "นักแก้ไขความผิดปกติการสื่อความหมาย",
  SPECIAL_EDU: "นักวิชาการศึกษาพิเศษ",
  CARDIO_TECH: "นักเทคโนโลยีหัวใจและทรวงอก",
};

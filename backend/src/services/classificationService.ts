import { RowDataPacket } from 'mysql2/promise';
import { query } from '../config/database.js';

export interface EmployeeProfile {
  citizen_id: string;
  position_name: string;
  specialist: string | null;
  expert: string | null;
  sub_department: string | null;
}

export interface MasterRate {
  rate_id: number;
  profession_code: string;
  group_no: number;
  item_no: string;
  amount: number;
}

const DOCTOR_KEYWORDS = ['แพทย์', 'นายแพทย์'];
const DOCTOR_GROUP3_KEYWORDS = ['อายุรกรรม', 'ออร์โธ', 'กุมาร', 'ศัลยกรรม', 'อายุรแพทย์'];
const DOCTOR_GROUP2_EXPERT = ['เฉพาะทาง', 'เวชปฏิบัติทั่วไป'];

const DENTIST_KEYWORDS = ['ทันตแพทย์'];
const DENTIST_GROUP3_EXPERT = ['เฉพาะทาง'];
const DENTIST_GROUP2_EXPERT = ['ทั่วไป'];

const PHARMACIST_KEYWORDS = ['เภสัชกร'];
const PHARMACIST_SUBDEPT = ['งานเภสัชกรรม', 'คลังยา', 'จ่ายยา'];
const PHARMACIST_EXPERT = ['เภสัชคลินิก', 'เภสัชกรรมคลินิก'];

const NURSE_TITLES = ['พยาบาลวิชาชีพ', 'พยาบาลเทคนิค', 'วิสัญญีพยาบาล'];
const NURSE_KEYWORDS = ['พยาบาล'];
const NURSE_GROUP3_SUB = ['ICU', 'CCU', 'วิกฤต', 'วิสัญญี'];
const NURSE_GROUP3_EXPERT = ['APN', 'วิสัญญี', 'ICU', 'CCU'];
const NURSE_GROUP2_SUB = ['OR', 'ER', 'LR', 'ห้องผ่าตัด', 'อุบัติเหตุ', 'ห้องคลอด', 'Ward', 'OPD'];
const NURSE_GROUP2_EXPERT = ['ER', 'OR', 'LR', 'NICU', 'PICU'];

const ALLIED_POS = ['นักกายภาพบำบัด', 'นักรังสีการแพทย์', 'นักโภชนาการ', 'นักเทคนิคการแพทย์'];

function normalize(value?: string | null): string {
  return (value || '').trim();
}

function startsWithAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.startsWith(pattern));
}

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

/**
 * Resolve recommended rate for a citizen based on profile keywords.
 * This is pure business logic so it can be unit tested independently.
 */
export async function findRecommendedRate(citizenId: string): Promise<MasterRate | null> {
  const rows = await query<RowDataPacket[]>(
    `SELECT citizen_id, position_name, specialist, expert, sub_department 
     FROM pts_employees WHERE citizen_id = ?`,
    [citizenId],
  );

  if (!rows || rows.length === 0) return null;
  const profile = rows[0] as EmployeeProfile;

  let targetProfession = '';
  let targetGroup = 1;

  const pos = normalize(profile.position_name);
  const specialist = normalize(profile.specialist);
  const expert = normalize(profile.expert);
  const subDept = normalize(profile.sub_department);

  const isAssistantNurse = startsWithAny(pos, ['ผู้ช่วยพยาบาล', 'พนักงานช่วยการพยาบาล']);
  const isNurseStrict = startsWithAny(pos, NURSE_TITLES);

  if (isAssistantNurse) {
    targetProfession = '';
  } else if (isNurseStrict) {
    targetProfession = 'NURSE';
    if (includesAny(subDept, NURSE_GROUP3_SUB) || includesAny(expert, NURSE_GROUP3_EXPERT)) {
      targetGroup = 3;
    } else if (includesAny(subDept, NURSE_GROUP2_SUB) || includesAny(expert, NURSE_GROUP2_EXPERT)) {
      targetGroup = 2;
    }
  } else if (includesAny(pos, DOCTOR_KEYWORDS)) {
    targetProfession = 'DOCTOR';
    if (includesAny(specialist, DOCTOR_GROUP3_KEYWORDS) || includesAny(expert, DOCTOR_GROUP3_KEYWORDS)) {
      targetGroup = 3;
    } else if (specialist !== '' || includesAny(expert, DOCTOR_GROUP2_EXPERT)) {
      targetGroup = 2;
    }
  } else if (includesAny(pos, DENTIST_KEYWORDS)) {
    targetProfession = 'DENTIST';
    if (includesAny(expert, DENTIST_GROUP3_EXPERT) || specialist !== '') {
      targetGroup = 3;
    } else if (includesAny(expert, DENTIST_GROUP2_EXPERT)) {
      targetGroup = 2;
    }
  } else if (includesAny(pos, PHARMACIST_KEYWORDS)) {
    targetProfession = 'PHARMACIST';
    if (includesAny(subDept, PHARMACIST_SUBDEPT) || includesAny(expert, PHARMACIST_EXPERT)) {
      targetGroup = 2;
    }
  } else if (!isAssistantNurse && includesAny(pos, NURSE_KEYWORDS)) {
    targetProfession = 'NURSE';
    if (includesAny(subDept, NURSE_GROUP3_SUB) || includesAny(expert, NURSE_GROUP3_EXPERT)) {
      targetGroup = 3;
    } else if (includesAny(subDept, NURSE_GROUP2_SUB) || includesAny(expert, NURSE_GROUP2_EXPERT)) {
      targetGroup = 2;
    }
  } else if (startsWithAny(pos, ALLIED_POS)) {
    targetProfession = 'ALLIED';
    targetGroup = 1;
  }

  if (!targetProfession) return null;

  const rates = await query<RowDataPacket[]>(
    `SELECT * FROM pts_master_rates 
       WHERE profession_code = ? AND group_no = ?
       AND is_active = 1
       ORDER BY amount DESC LIMIT 1`,
    [targetProfession, targetGroup],
  );

  return rates.length > 0 ? (rates[0] as MasterRate) : null;
}

export async function getAllActiveMasterRates(): Promise<RowDataPacket[]> {
  return await query<RowDataPacket[]>(`SELECT * FROM pts_master_rates WHERE is_active = 1`);
}

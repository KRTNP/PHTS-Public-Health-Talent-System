import { RowDataPacket } from 'mysql2/promise';
import { query } from '../../../config/database.js';
import * as RULES from './constants.js';

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

export interface ClassificationResult {
  group_id: number;
  group_name: string;
  rate_amount: number;
  criteria_text?: string | null;
}

function normalize(value?: string | null): string {
  return (value || '').trim().toUpperCase();
}

function startsWithAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.startsWith(pattern));
}

function includesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

type TargetRecommendation = Readonly<{
  profession: string;
  group: number;
  itemHint: string;
}>;

const resolveNurseGroup = (subDept: string, expert: string): TargetRecommendation => {
  if (includesAny(subDept, RULES.NURSE_GROUP3_SUB) || includesAny(expert, RULES.NURSE_GROUP3_EXPERT)) {
    return { profession: 'NURSE', group: 3, itemHint: '3.1' };
  }
  if (includesAny(subDept, RULES.NURSE_GROUP2_SUB) || includesAny(expert, RULES.NURSE_GROUP2_EXPERT)) {
    return { profession: 'NURSE', group: 2, itemHint: '2.1' };
  }
  return { profession: 'NURSE', group: 1, itemHint: '1.1' };
};

const resolveNurseTarget = (
  pos: string,
  subDept: string,
  expert: string,
): TargetRecommendation | null => {
  if (startsWithAny(pos, RULES.ASSISTANT_NURSE_POS)) {
    return null;
  }
  if (startsWithAny(pos, RULES.NURSE_TITLES)) {
    return resolveNurseGroup(subDept, expert);
  }
  return null;
};

const resolveDentistTarget = (
  pos: string,
  specialist: string,
  expert: string,
): TargetRecommendation | null => {
  if (!includesAny(pos, RULES.DENTIST_KEYWORDS)) {
    return null;
  }
  if (includesAny(expert, RULES.DENTIST_GROUP3_EXPERT) || specialist !== '') {
    return { profession: 'DENTIST', group: 3, itemHint: '3.1' };
  }
  if (includesAny(expert, RULES.DENTIST_GROUP2_EXPERT)) {
    return { profession: 'DENTIST', group: 2, itemHint: '2.1' };
  }
  return { profession: 'DENTIST', group: 1, itemHint: '' };
};

const resolveDoctorTarget = (
  pos: string,
  specialist: string,
  expert: string,
): TargetRecommendation | null => {
  if (!includesAny(pos, RULES.DOCTOR_KEYWORDS)) {
    return null;
  }
  for (const [keyword, itemNo] of Object.entries(RULES.DOCTOR_ITEM_MAP)) {
    if (specialist.includes(keyword) || expert.includes(keyword)) {
      return { profession: 'DOCTOR', group: 3, itemHint: itemNo };
    }
  }
  if (specialist !== '' || includesAny(expert, RULES.DOCTOR_GROUP2_EXPERT)) {
    return { profession: 'DOCTOR', group: 2, itemHint: '2.1' };
  }
  return { profession: 'DOCTOR', group: 1, itemHint: '1.1' };
};

const resolvePharmacistTarget = (
  pos: string,
  subDept: string,
  expert: string,
): TargetRecommendation | null => {
  if (!includesAny(pos, RULES.PHARMACIST_KEYWORDS)) {
    return null;
  }
  if (includesAny(subDept, RULES.PHARMACIST_SUBDEPT) || includesAny(expert, RULES.PHARMACIST_EXPERT)) {
    return { profession: 'PHARMACIST', group: 2, itemHint: '2.1' };
  }
  return { profession: 'PHARMACIST', group: 1, itemHint: '' };
};

const resolveGenericNurseTarget = (
  pos: string,
  subDept: string,
  expert: string,
): TargetRecommendation | null => {
  if (startsWithAny(pos, RULES.ASSISTANT_NURSE_POS)) {
    return null;
  }
  if (includesAny(pos, RULES.NURSE_KEYWORDS)) {
    return resolveNurseGroup(subDept, expert);
  }
  return null;
};

const resolveAlliedTarget = (pos: string): TargetRecommendation | null => {
  if (startsWithAny(pos, RULES.ALLIED_POS)) {
    return { profession: 'ALLIED', group: 5, itemHint: '5.1' };
  }
  return null;
};

/**
 * Get employee data source table/view name based on environment
 * - Production: uses 'employees' view (real-time sync from HRMS)
 * - Test: uses 'emp_profiles' table (test data)
 */
function getEmployeeDataSource(): string {
  // ใช้ emp_profiles สำหรับ test environment
  // ใช้ employees view (HRMS sync) สำหรับ production
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.DB_NAME?.includes('test');
  return isTestEnv ? 'emp_profiles' : 'employees';
}

/**
 * Resolve recommended rate for a citizen based on profile keywords.
 * FINAL LOGIC: Doctor item mapping, Dentist board->grp3, Nurse NP general->grp2, APN/ICU->grp3
 */
export async function findRecommendedRate(citizenId: string): Promise<MasterRate | null> {
  const dataSource = getEmployeeDataSource();

  // Note: employees view uses 'start_current_position', emp_profiles uses 'start_work_date'
  const rows = await query<RowDataPacket[]>(
    `SELECT citizen_id, position_name, specialist, expert, sub_department
     FROM ${dataSource} WHERE citizen_id = ?`,
    [citizenId],
  );

  if (!rows || rows.length === 0) return null;
  const profile = rows[0] as EmployeeProfile;

  const pos = normalize(profile.position_name);
  const specialist = normalize(profile.specialist);
  const expert = normalize(profile.expert);
  const subDept = normalize(profile.sub_department);
  const target =
    resolveNurseTarget(pos, subDept, expert) ??
    resolveDentistTarget(pos, specialist, expert) ??
    resolveDoctorTarget(pos, specialist, expert) ??
    resolvePharmacistTarget(pos, subDept, expert) ??
    resolveGenericNurseTarget(pos, subDept, expert) ??
    resolveAlliedTarget(pos);

  if (!target) return null;

  // SQL Query with Item Hinting Logic
  let sql = `SELECT * FROM cfg_payment_rates 
       WHERE profession_code = ? AND group_no = ?
       AND is_active = 1`;
  const params: any[] = [target.profession, target.group];

  if (target.itemHint) {
    sql += ` ORDER BY CASE WHEN item_no = ? THEN 1 ELSE 2 END, item_no ASC, amount DESC LIMIT 1`;
    params.push(target.itemHint);
  } else {
    sql += ` ORDER BY item_no ASC, amount DESC LIMIT 1`;
  }

  const rates = await query<RowDataPacket[]>(sql, params);

  return rates.length > 0 ? (rates[0] as MasterRate) : null;
}

export async function getAllActiveMasterRates(): Promise<RowDataPacket[]> {
  return await query<RowDataPacket[]>(`SELECT * FROM cfg_payment_rates WHERE is_active = 1`);
}

export async function classifyEmployee(employee: EmployeeProfile): Promise<ClassificationResult | null> {
  const rate = await findRecommendedRate(employee.citizen_id);
  if (!rate) return null;

  return {
    group_id: rate.group_no,
    group_name: `กลุ่ม ${rate.group_no}`,
    rate_amount: rate.amount,
    criteria_text: null,
  };
}

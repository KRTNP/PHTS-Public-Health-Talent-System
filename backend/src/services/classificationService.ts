import { RowDataPacket } from 'mysql2/promise';
import { query } from '../config/database.js';
import * as RULES from '../config/classification.constants.js';

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

/**
 * Resolve recommended rate for a citizen based on profile keywords.
 * FINAL LOGIC: Doctor item mapping, Dentist board->grp3, Nurse NP general->grp2, APN/ICU->grp3
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
  let targetItemHint = '';

  const pos = normalize(profile.position_name);
  const specialist = normalize(profile.specialist);
  const expert = normalize(profile.expert);
  const subDept = normalize(profile.sub_department);

  const isAssistantNurse = startsWithAny(pos, RULES.ASSISTANT_NURSE_POS);
  const isNurseStrict = startsWithAny(pos, RULES.NURSE_TITLES);

  // 1. NURSE LOGIC
  if (isAssistantNurse) {
    targetProfession = '';
  } else if (isNurseStrict) {
    targetProfession = 'NURSE';
    if (includesAny(subDept, RULES.NURSE_GROUP3_SUB) || includesAny(expert, RULES.NURSE_GROUP3_EXPERT)) {
      targetGroup = 3;
      targetItemHint = '3.1'; // default critical/anaes
    } else if (includesAny(subDept, RULES.NURSE_GROUP2_SUB) || includesAny(expert, RULES.NURSE_GROUP2_EXPERT)) {
      targetGroup = 2;
      targetItemHint = '2.1'; // default ward/IPD/general NP
    } else {
      targetGroup = 1;
      targetItemHint = '1.1';
    }

    // 2. DENTIST LOGIC
  } else if (includesAny(pos, RULES.DENTIST_KEYWORDS)) {
    targetProfession = 'DENTIST';
    if (includesAny(expert, RULES.DENTIST_GROUP3_EXPERT) || (specialist !== '' && specialist !== null)) {
      targetGroup = 3;
      targetItemHint = '3.1';
    } else if (includesAny(expert, RULES.DENTIST_GROUP2_EXPERT)) {
      targetGroup = 2;
      targetItemHint = '2.1';
    }

    // 3. DOCTOR LOGIC
  } else if (includesAny(pos, RULES.DOCTOR_KEYWORDS)) {
    targetProfession = 'DOCTOR';
    let matchedItem = '';
    for (const [keyword, itemNo] of Object.entries(RULES.DOCTOR_ITEM_MAP)) {
      if (specialist.includes(keyword) || expert.includes(keyword)) {
        matchedItem = itemNo;
        break;
      }
    }
    if (matchedItem) {
      targetGroup = 3;
      targetItemHint = matchedItem;
    } else if (specialist !== '' || includesAny(expert, RULES.DOCTOR_GROUP2_EXPERT)) {
      targetGroup = 2;
      targetItemHint = '2.1';
    } else {
      targetGroup = 1;
      targetItemHint = '1.1';
    }

    // 4. PHARMACIST LOGIC
  } else if (includesAny(pos, RULES.PHARMACIST_KEYWORDS)) {
    targetProfession = 'PHARMACIST';
    if (includesAny(subDept, RULES.PHARMACIST_SUBDEPT) || includesAny(expert, RULES.PHARMACIST_EXPERT)) {
      targetGroup = 2;
      targetItemHint = '2.1';
    }

    // 5. GENERIC NURSE FALLBACK
  } else if (!isAssistantNurse && includesAny(pos, RULES.NURSE_KEYWORDS)) {
    targetProfession = 'NURSE';
    if (includesAny(subDept, RULES.NURSE_GROUP3_SUB) || includesAny(expert, RULES.NURSE_GROUP3_EXPERT)) {
      targetGroup = 3;
      targetItemHint = '3.1';
    } else if (includesAny(subDept, RULES.NURSE_GROUP2_SUB) || includesAny(expert, RULES.NURSE_GROUP2_EXPERT)) {
      targetGroup = 2;
      targetItemHint = '2.1';
    } else {
      targetGroup = 1;
      targetItemHint = '1.1';
    }

    // 6. ALLIED LOGIC
  } else if (startsWithAny(pos, RULES.ALLIED_POS)) {
    targetProfession = 'ALLIED';
    targetGroup = 5;
    targetItemHint = '5.1';
  }

  if (!targetProfession) return null;

  // SQL Query with Item Hinting Logic
  let sql = `SELECT * FROM pts_master_rates 
       WHERE profession_code = ? AND group_no = ?
       AND is_active = 1`;
  const params: any[] = [targetProfession, targetGroup];

  if (targetItemHint) {
    sql += ` ORDER BY CASE WHEN item_no = ? THEN 1 ELSE 2 END, item_no ASC, amount DESC LIMIT 1`;
    params.push(targetItemHint);
  } else {
    sql += ` ORDER BY item_no ASC, amount DESC LIMIT 1`;
  }

  const rates = await query<RowDataPacket[]>(sql, params);

  return rates.length > 0 ? (rates[0] as MasterRate) : null;
}

export async function getAllActiveMasterRates(): Promise<RowDataPacket[]> {
  return await query<RowDataPacket[]>(`SELECT * FROM pts_master_rates WHERE is_active = 1`);
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

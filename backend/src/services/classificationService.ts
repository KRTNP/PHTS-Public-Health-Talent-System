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

  const isAssistantNurse = startsWithAny(pos, RULES.ASSISTANT_NURSE_POS);
  const isNurseStrict = startsWithAny(pos, RULES.NURSE_TITLES);

  if (isAssistantNurse) {
    targetProfession = '';
  } else if (isNurseStrict) {
    targetProfession = 'NURSE';
    if (includesAny(subDept, RULES.NURSE_GROUP3_SUB) || includesAny(expert, RULES.NURSE_GROUP3_EXPERT)) {
      targetGroup = 3;
    } else if (includesAny(subDept, RULES.NURSE_GROUP2_SUB) || includesAny(expert, RULES.NURSE_GROUP2_EXPERT)) {
      targetGroup = 2;
    }
  } else if (includesAny(pos, RULES.DOCTOR_KEYWORDS)) {
    targetProfession = 'DOCTOR';
    if (
      includesAny(specialist, RULES.DOCTOR_GROUP3_KEYWORDS) ||
      includesAny(expert, RULES.DOCTOR_GROUP3_KEYWORDS)
    ) {
      targetGroup = 3;
    } else if (specialist !== '' || includesAny(expert, RULES.DOCTOR_GROUP2_EXPERT)) {
      targetGroup = 2;
    }
  } else if (includesAny(pos, RULES.DENTIST_KEYWORDS)) {
    targetProfession = 'DENTIST';
    if (includesAny(expert, RULES.DENTIST_GROUP3_EXPERT) || specialist !== '') {
      targetGroup = 3;
    } else if (includesAny(expert, RULES.DENTIST_GROUP2_EXPERT)) {
      targetGroup = 2;
    }
  } else if (includesAny(pos, RULES.PHARMACIST_KEYWORDS)) {
    targetProfession = 'PHARMACIST';
    if (includesAny(subDept, RULES.PHARMACIST_SUBDEPT) || includesAny(expert, RULES.PHARMACIST_EXPERT)) {
      targetGroup = 2;
    }
  } else if (!isAssistantNurse && includesAny(pos, RULES.NURSE_KEYWORDS)) {
    targetProfession = 'NURSE';
    if (includesAny(subDept, RULES.NURSE_GROUP3_SUB) || includesAny(expert, RULES.NURSE_GROUP3_EXPERT)) {
      targetGroup = 3;
    } else if (includesAny(subDept, RULES.NURSE_GROUP2_SUB) || includesAny(expert, RULES.NURSE_GROUP2_EXPERT)) {
      targetGroup = 2;
    }
  } else if (startsWithAny(pos, RULES.ALLIED_POS)) {
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

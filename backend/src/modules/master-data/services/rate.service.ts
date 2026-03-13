/**
 * PHTS System - Payment Rate Service
 *
 * Manages position allowance rates (P.T.S. rates).
 */

import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { MasterDataRepository } from '@/modules/master-data/repositories/master-data.repository.js';
import { ConflictError } from '@shared/utils/errors.js';

type CreateMasterRatePayload = {
  profession_code: string;
  group_no: number;
  item_no: string | null;
  sub_item_no: string | null;
  amount: number;
  condition_desc: string;
  detailed_desc: string;
  is_active: number;
  actorId?: number;
};

export const getMasterRates = async (): Promise<any[]> => {
  return MasterDataRepository.findMasterRatesWithEligibility();
};

export const updateMasterRate = async (
  rateId: number,
  payload: {
    profession_code: string;
    group_no: number;
    item_no: string | null;
    sub_item_no: string | null;
    amount: number;
    condition_desc: string;
    detailed_desc: string;
    is_active: boolean;
  },
  actorId?: number,
): Promise<void> => {
  await MasterDataRepository.updateMasterRate({ rateId, ...payload });

  await emitAuditEvent({
    eventType: AuditEventType.MASTER_RATE_UPDATE,
    entityType: "payment_rate",
    entityId: rateId,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "update",
      ...payload,
    },
  });
};

export const deleteMasterRate = async (
  rateId: number,
  actorId?: number,
): Promise<void> => {
  const referenceCount = await MasterDataRepository.countMasterRateReferences(rateId);
  if (referenceCount > 0) {
    throw new ConflictError(
      `ไม่สามารถลบอัตราเงินนี้ได้ เนื่องจากมีข้อมูลอ้างอิงอยู่ ${referenceCount} รายการ`,
    );
  }

  await MasterDataRepository.deleteMasterRatePermanently(rateId);

  await emitAuditEvent({
    eventType: AuditEventType.MASTER_RATE_UPDATE,
    entityType: "payment_rate",
    entityId: rateId,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "delete",
    },
  });
};

export const createMasterRate = async ({
  profession_code,
  group_no,
  item_no,
  sub_item_no,
  amount,
  condition_desc,
  detailed_desc,
  is_active,
  actorId,
}: CreateMasterRatePayload): Promise<number> => {
  const rateId = await MasterDataRepository.createMasterRate({
    profession_code,
    group_no,
    item_no,
    sub_item_no,
    amount,
    condition_desc,
    detailed_desc,
    is_active,
  });

  await emitAuditEvent({
    eventType: AuditEventType.MASTER_RATE_UPDATE,
    entityType: "payment_rate",
    entityId: rateId,
    actorId: actorId ?? null,
    actorRole: null,
    actionDetail: {
      action: "create",
      profession_code,
      group_no,
      amount,
    },
  });

  return rateId;
};

export const getMasterRateById = async (rateId: number): Promise<any | null> => {
  return MasterDataRepository.findMasterRateById(rateId);
};

/**
 * Get payment rates filtered by profession code.
 * This is used for the simplified dropdown in the request wizard.
 */
export const getRatesByProfession = async (
  professionCode: string,
): Promise<any[]> => {
  return MasterDataRepository.findRatesByProfession(professionCode);
};

/**
 * Get distinct profession codes that have active rates.
 */
export const getProfessions = async (): Promise<string[]> => {
  const rows = await MasterDataRepository.findProfessions();
  return rows.map((r) => r.profession_code);
};

// Types for the hierarchy response
export interface CriterionNode {
  id: string;
  label: string;
  description?: string;
  rateId?: number;
  subCriteria?: CriterionNode[];
}

export interface GroupNode {
  id: string;
  name: string;
  rate: number;
  criteria: CriterionNode[];
}

export interface ProfessionNode {
  id: string;
  name: string;
  groups: GroupNode[];
}

export const getRateHierarchy = async (): Promise<ProfessionNode[]> => {
  // Fetch active rates sorted by hierarchy
  const rows = await MasterDataRepository.findRateHierarchyRows();

  const profNameMap: Record<string, string> = {
    DOCTOR: "กลุ่มแพทย์",
    DENTIST: "กลุ่มทันตแพทย์",
    PHARMACIST: "กลุ่มเภสัชกร",
    NURSE: "กลุ่มพยาบาลวิชาชีพ",
    SPECIAL_EDU: "กลุ่มการศึกษาพิเศษ",
  };
  const hierarchy: ProfessionNode[] = [];
  const professionMap = new Map<string, ProfessionNode>();

  const getOrCreateProfession = (professionCode: string): ProfessionNode => {
    const existing = professionMap.get(professionCode);
    if (existing) return existing;
    const next: ProfessionNode = {
      id: professionCode,
      name: profNameMap[professionCode] ?? professionCode,
      groups: [],
    };
    professionMap.set(professionCode, next);
    hierarchy.push(next);
    return next;
  };

  const getOrCreateGroup = (
    profession: ProfessionNode,
    groupNo: number,
    amount: number,
  ): GroupNode => {
    const groupId = String(groupNo);
    const existing = profession.groups.find((group) => group.id === groupId);
    if (existing) return existing;
    const next: GroupNode = {
      id: groupId,
      name: `กลุ่มที่ ${groupNo}`,
      rate: Number(amount),
      criteria: [],
    };
    profession.groups.push(next);
    return next;
  };

  const getOrCreateCriterion = (
    group: GroupNode,
    itemNo: string,
    label: string,
    description: string,
    rateId?: number,
  ): CriterionNode => {
    const existing = group.criteria.find((criterion) => criterion.id === itemNo);
    if (existing) return existing;
    const next: CriterionNode = {
      id: itemNo,
      label,
      description,
      rateId,
      subCriteria: [],
    };
    group.criteria.push(next);
    return next;
  };

  for (const row of rows) {
    const profession = getOrCreateProfession(String(row.profession_code));
    const group = getOrCreateGroup(profession, Number(row.group_no), Number(row.amount));

    const itemNo = row.item_no ? String(row.item_no) : "";
    const subItemNo = row.sub_item_no ? String(row.sub_item_no) : "";
    const label = row.condition_desc || "";
    const description = row.detailed_desc || label;

    if (!itemNo) {
      if (label) {
        group.criteria.push({
          id: "",
          label,
          description,
          rateId: Number(row.rate_id),
        });
      }
      continue;
    }

    const criterion = getOrCreateCriterion(
      group,
      itemNo,
      label,
      description,
      Number(row.rate_id),
    );
    if (!subItemNo) {
      criterion.label = label;
      criterion.description = description;
      criterion.rateId = Number(row.rate_id);
      continue;
    }
    criterion.subCriteria?.push({
      id: subItemNo,
      label,
      description,
      rateId: Number(row.rate_id),
    });
  }

  return hierarchy;
};

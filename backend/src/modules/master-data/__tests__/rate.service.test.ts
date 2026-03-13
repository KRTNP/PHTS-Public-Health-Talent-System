import { AuditEventType } from '@/modules/audit/entities/audit.entity.js';

jest.mock('@/modules/master-data/repositories/master-data.repository.js', () => ({
  MasterDataRepository: {
    countMasterRateReferences: jest.fn(),
    deleteMasterRatePermanently: jest.fn(),
    findRateHierarchyRows: jest.fn(),
  },
}));

jest.mock('@/modules/audit/services/audit.service.js', () => {
  const actual = jest.requireActual('@/modules/audit/services/audit.service.js');
  return {
    ...actual,
    emitAuditEvent: jest.fn(),
  };
});

import { emitAuditEvent } from '@/modules/audit/services/audit.service.js';
import { MasterDataRepository } from '@/modules/master-data/repositories/master-data.repository.js';
import { deleteMasterRate, getRateHierarchy } from '../services/rate.service.js';

describe("MasterData Rate Service", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("deleteMasterRate permanently deletes rate when no references and writes audit log", async () => {
    const rateId = 123;
    const actorId = 99;

    (MasterDataRepository.countMasterRateReferences as jest.Mock).mockResolvedValueOnce(0);
    (MasterDataRepository.deleteMasterRatePermanently as jest.Mock).mockResolvedValueOnce(undefined);

    await deleteMasterRate(rateId, actorId);

    expect(MasterDataRepository.countMasterRateReferences).toHaveBeenCalledWith(rateId);
    expect(MasterDataRepository.deleteMasterRatePermanently).toHaveBeenCalledWith(rateId);

    expect(emitAuditEvent).toHaveBeenCalledWith({
      eventType: AuditEventType.MASTER_RATE_UPDATE,
      entityType: "payment_rate",
      entityId: rateId,
      actorId,
      actorRole: null,
      actionDetail: {
        action: "delete",
      },
    });
  });

  test("deleteMasterRate rejects when rate is referenced", async () => {
    const rateId = 456;
    (MasterDataRepository.countMasterRateReferences as jest.Mock).mockResolvedValueOnce(3);

    await expect(deleteMasterRate(rateId, 22)).rejects.toThrow(
      "ไม่สามารถลบอัตราเงินนี้ได้ เนื่องจากมีข้อมูลอ้างอิงอยู่ 3 รายการ",
    );

    expect(MasterDataRepository.deleteMasterRatePermanently).not.toHaveBeenCalled();
    expect(emitAuditEvent).not.toHaveBeenCalled();
  });

  test("getRateHierarchy preserves rate ids on criteria and subCriteria", async () => {
    (MasterDataRepository.findRateHierarchyRows as jest.Mock).mockResolvedValueOnce([
      {
        rate_id: 11,
        profession_code: 'DOCTOR',
        group_no: 1,
        item_no: 'A',
        sub_item_no: null,
        amount: 5000,
        condition_desc: 'หลักเกณฑ์แพทย์',
        detailed_desc: 'แพทย์ใช้เกณฑ์เฉพาะกลุ่ม 1',
      },
      {
        rate_id: 12,
        profession_code: 'DOCTOR',
        group_no: 1,
        item_no: 'A',
        sub_item_no: '1',
        amount: 5000,
        condition_desc: 'รายละเอียดแพทย์',
        detailed_desc: 'รายละเอียดเพิ่มเติมของแพทย์',
      },
    ]);

    const hierarchy = await getRateHierarchy();

    expect(hierarchy[0].groups[0].criteria[0]).toMatchObject({
      id: 'A',
      rateId: 11,
      description: 'แพทย์ใช้เกณฑ์เฉพาะกลุ่ม 1',
    });
    expect(hierarchy[0].groups[0].criteria[0].subCriteria?.[0]).toMatchObject({
      id: '1',
      rateId: 12,
      description: 'รายละเอียดเพิ่มเติมของแพทย์',
    });
  });
});

import { AuditEventType } from '@/modules/audit/entities/audit.entity.js';

jest.mock('@/modules/master-data/repositories/master-data.repository.js', () => ({
  MasterDataRepository: {
    deactivateHoliday: jest.fn(),
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
import { deleteHoliday } from '../services/holiday.service.js';

describe('Holiday Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('deleteHoliday deactivates by date-only match (supports DATETIME) and writes audit log', async () => {
    const date = '2026-02-15';
    const actorId = 99;

    (MasterDataRepository.deactivateHoliday as jest.Mock).mockResolvedValueOnce(undefined);

    await deleteHoliday(date, actorId);

    expect(MasterDataRepository.deactivateHoliday).toHaveBeenCalledWith(date);

    expect(emitAuditEvent).toHaveBeenCalledWith({
      eventType: AuditEventType.HOLIDAY_UPDATE,
      entityType: 'holiday',
      entityId: null,
      actorId,
      actorRole: null,
      actionDetail: {
        action: 'DEACTIVATE',
        holiday_date: date,
      },
    });
  });
});

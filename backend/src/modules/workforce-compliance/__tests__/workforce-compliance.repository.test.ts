import type { RowDataPacket } from 'mysql2/promise';

const queryMock = jest.fn();
const executeMock = jest.fn();

jest.mock('@config/database.js', () => ({
  __esModule: true,
  default: {
    query: queryMock,
    execute: executeMock,
  },
}));

describe('WorkforceComplianceRepository movement listing and manual movement guards', () => {
  beforeEach(() => {
    queryMock.mockReset();
    executeMock.mockReset();
  });

  test('lists both synced and manual resign and transfer out rows', async () => {
    const mod = await import('../repositories/workforce-compliance.repository.js');
    queryMock.mockResolvedValue([[{ movement_id: 1 }] as RowDataPacket[]]);

    await mod.WorkforceComplianceRepository.getPersonnelMovements();

    const [sql] = queryMock.mock.calls[0] ?? [];
    expect(sql).toContain("CASE WHEN m.source_movement_id IS NULL THEN 1 ELSE 0 END AS is_manual_entry");
    expect(sql).not.toContain("AND m.source_movement_id IS NULL");
    expect(sql).toContain("COLLATE utf8mb4_unicode_ci");
  });

  test('updates only manual movement rows', async () => {
    const mod = await import('../repositories/workforce-compliance.repository.js');
    executeMock.mockResolvedValue([{ affectedRows: 1 }]);

    await mod.WorkforceComplianceRepository.updatePersonnelMovement(7, {
      citizen_id: '1234567890123',
      movement_type: 'RESIGN',
      effective_date: '2026-03-01',
      remark: 'manual',
    });

    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('source_movement_id IS NULL'),
      ['1234567890123', 'RESIGN', '2026-03-01', 'manual', 7],
    );
  });

  test('deletes only manual movement rows', async () => {
    const mod = await import('../repositories/workforce-compliance.repository.js');
    executeMock.mockResolvedValue([{ affectedRows: 1 }]);

    await mod.WorkforceComplianceRepository.deletePersonnelMovement(9);

    expect(executeMock).toHaveBeenCalledWith(
      expect.stringContaining('source_movement_id IS NULL'),
      [9],
    );
  });
});

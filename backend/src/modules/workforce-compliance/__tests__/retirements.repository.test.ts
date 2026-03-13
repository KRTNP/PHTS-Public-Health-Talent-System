import type { RowDataPacket } from 'mysql2/promise';

const queryMock = jest.fn();

jest.mock('@config/database.js', () => ({
  __esModule: true,
  default: {
    query: queryMock,
    execute: jest.fn(),
  },
}));

describe('RetirementsRepository list query', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  test('uses explicit collation on citizen_id join to avoid mixed-collation crashes', async () => {
    const mod = await import('../repositories/retirements.repository.js');
    queryMock.mockResolvedValue([[{ retirement_id: 1 }] as RowDataPacket[]]);

    await mod.RetirementsRepository.list();

    const [sql] = queryMock.mock.calls[0] ?? [];
    expect(sql).toContain('LEFT JOIN emp_profiles e ON');
    expect(sql).toContain('COLLATE utf8mb4_unicode_ci');
    expect(sql).toContain('e.citizen_id');
    expect(sql).toContain('r.citizen_id');
  });
});


import type { RowDataPacket } from 'mysql2';

const mockQuery = jest.fn();

jest.mock('@config/database.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

describe('TransformMonitorRepository.getSyncRecords', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('falls back to the latest batch that has actual records when preferred batch is empty', async () => {
    mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM hrms_sync_batches') && sql.includes('ORDER BY batch_id DESC')) {
        return [
          {
            batch_id: 23,
            started_at: '2026-03-13 16:10:00',
            finished_at: '2026-03-13 16:10:02',
          },
          {
            batch_id: 17,
            started_at: '2026-03-12 10:00:00',
            finished_at: '2026-03-12 10:00:05',
          },
        ] as RowDataPacket[];
      }

      if (sql.includes('SELECT COUNT(*) AS total') && sql.includes('FROM `users`') && !sql.includes('ORDER BY')) {
        const [windowStart] = (params ?? []) as [string, string];
        if (windowStart === '2026-03-13 16:10:00') return [{ total: 0 }] as RowDataPacket[];
        return [{ total: 2 }] as RowDataPacket[];
      }

      if (sql.includes('SELECT COUNT(*) AS total') && sql.includes('FROM `')) {
        return [{ total: 0 }] as RowDataPacket[];
      }

      if (sql.includes('FROM `users`') && sql.includes('ORDER BY')) {
        return [
          { id: 1001, citizen_id: '1234567890123', role: 'USER', is_active: 1, updated_at: '2026-03-12 10:00:02' },
          { id: 1002, citizen_id: '9876543210987', role: 'USER', is_active: 1, updated_at: '2026-03-12 10:00:03' },
        ] as RowDataPacket[];
      }

      return [] as RowDataPacket[];
    });

    const { TransformMonitorRepository } = await import('../../repositories/transform-monitor.repository.js');

    const result = await TransformMonitorRepository.getSyncRecords({
      page: 1,
      limit: 10,
    });

    expect(result.batch_id).toBe(17);
    expect(result.total).toBe(2);
    expect(result.rows).toHaveLength(2);
    expect(result.table_counts.users).toBe(2);
  });
});

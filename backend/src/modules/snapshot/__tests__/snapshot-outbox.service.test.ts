jest.mock('@/modules/snapshot/repositories/snapshot.repository.js', () => ({
  SnapshotRepository: {
    hasColumn: jest.fn().mockResolvedValue(true),
    executeRaw: jest.fn().mockResolvedValue(undefined),
    getConnection: jest.fn(),
    reclaimStuckProcessing: jest.fn().mockResolvedValue(0),
    findOutboxBatchForUpdate: jest.fn().mockResolvedValue([]),
    markOutboxProcessing: jest.fn().mockResolvedValue(undefined),
    markOutboxSent: jest.fn().mockResolvedValue(undefined),
    markOutboxFailed: jest.fn().mockResolvedValue(undefined),
    setPeriodSnapshotFailed: jest.fn().mockResolvedValue(undefined),
    findPeriodByIdForUpdate: jest.fn(),
    setPeriodSnapshotProcessing: jest.fn().mockResolvedValue(undefined),
    findPayoutsForSnapshot: jest.fn().mockResolvedValue([]),
    deleteSnapshotsForPeriod: jest.fn().mockResolvedValue(undefined),
    createSnapshot: jest.fn().mockResolvedValue(1),
    setPeriodSnapshotReady: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/modules/audit/services/audit.service.js', () => ({
  AuditEventType: {
    OTHER: 'OTHER',
    SNAPSHOT_FREEZE: 'SNAPSHOT_FREEZE',
  },
  emitAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('snapshot outbox service', () => {
  const originalEnv = {
    maxAttempts: process.env.SNAPSHOT_OUTBOX_MAX_ATTEMPTS,
    retryBase: process.env.SNAPSHOT_OUTBOX_RETRY_BASE_SECONDS,
    retryMax: process.env.SNAPSHOT_OUTBOX_RETRY_MAX_SECONDS,
    timeout: process.env.SNAPSHOT_OUTBOX_PROCESSING_TIMEOUT_SECONDS,
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SNAPSHOT_OUTBOX_MAX_ATTEMPTS = '8';
    process.env.SNAPSHOT_OUTBOX_RETRY_BASE_SECONDS = '30';
    process.env.SNAPSHOT_OUTBOX_RETRY_MAX_SECONDS = '1800';
    process.env.SNAPSHOT_OUTBOX_PROCESSING_TIMEOUT_SECONDS = '300';
  });

  afterAll(() => {
    if (originalEnv.maxAttempts === undefined) delete process.env.SNAPSHOT_OUTBOX_MAX_ATTEMPTS;
    else process.env.SNAPSHOT_OUTBOX_MAX_ATTEMPTS = originalEnv.maxAttempts;
    if (originalEnv.retryBase === undefined) delete process.env.SNAPSHOT_OUTBOX_RETRY_BASE_SECONDS;
    else process.env.SNAPSHOT_OUTBOX_RETRY_BASE_SECONDS = originalEnv.retryBase;
    if (originalEnv.retryMax === undefined) delete process.env.SNAPSHOT_OUTBOX_RETRY_MAX_SECONDS;
    else process.env.SNAPSHOT_OUTBOX_RETRY_MAX_SECONDS = originalEnv.retryMax;
    if (originalEnv.timeout === undefined) delete process.env.SNAPSHOT_OUTBOX_PROCESSING_TIMEOUT_SECONDS;
    else process.env.SNAPSHOT_OUTBOX_PROCESSING_TIMEOUT_SECONDS = originalEnv.timeout;
  });

  test('reclaims stuck processing rows before reading pending work', async () => {
    const { SnapshotRepository } = await import('@/modules/snapshot/repositories/snapshot.repository.js');
    const conn = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    (SnapshotRepository.getConnection as jest.Mock).mockResolvedValue(conn);
    (SnapshotRepository.reclaimStuckProcessing as jest.Mock).mockResolvedValueOnce(2);
    (SnapshotRepository.findOutboxBatchForUpdate as jest.Mock).mockResolvedValueOnce([]);

    const { processSnapshotOutboxBatch } = await import('@/modules/snapshot/services/snapshot.service.js');
    const result = await processSnapshotOutboxBatch(20);

    expect(SnapshotRepository.reclaimStuckProcessing).toHaveBeenCalledWith(
      300,
      8,
      30,
      1800,
      conn,
    );
    expect(SnapshotRepository.findOutboxBatchForUpdate).toHaveBeenCalledWith(20, 8, conn);
    expect(result).toEqual({ processed: 0, sent: 0, failed: 0, requeued: 2 });
  });

  test('marks failed rows with retry policy when snapshot generation fails', async () => {
    const { SnapshotRepository } = await import('@/modules/snapshot/repositories/snapshot.repository.js');
    const { emitAuditEvent } = await import('@/modules/audit/services/audit.service.js');
    const conn = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    (SnapshotRepository.getConnection as jest.Mock).mockResolvedValue(conn);
    (SnapshotRepository.findOutboxBatchForUpdate as jest.Mock).mockResolvedValueOnce([
      { outbox_id: 44, period_id: 9, requested_by: 7 },
    ]);
    (SnapshotRepository.findPeriodByIdForUpdate as jest.Mock).mockResolvedValueOnce({
      period_id: 9,
      period_month: 2,
      period_year: 2026,
      status: 'CLOSED',
    });
    (SnapshotRepository.findPayoutsForSnapshot as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    const { processSnapshotOutboxBatch } = await import('@/modules/snapshot/services/snapshot.service.js');
    const result = await processSnapshotOutboxBatch(10);

    expect(SnapshotRepository.markOutboxProcessing).toHaveBeenCalledWith(44, conn);
    expect(SnapshotRepository.markOutboxFailed).toHaveBeenCalledWith(
      44,
      'boom',
      8,
      30,
      1800,
      conn,
    );
    expect(SnapshotRepository.setPeriodSnapshotFailed).toHaveBeenCalledWith(9, conn);
    expect(emitAuditEvent).toHaveBeenCalled();
    expect(result).toEqual({ processed: 1, sent: 0, failed: 1, requeued: 0 });
  });

  test('sums string total_payable values as numbers when creating snapshots', async () => {
    const { SnapshotRepository } = await import('@/modules/snapshot/repositories/snapshot.repository.js');
    const conn = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    (SnapshotRepository.getConnection as jest.Mock).mockResolvedValue(conn);
    (SnapshotRepository.findOutboxBatchForUpdate as jest.Mock).mockResolvedValueOnce([
      { outbox_id: 45, period_id: 38, requested_by: 77 },
    ]);
    (SnapshotRepository.findPeriodByIdForUpdate as jest.Mock).mockResolvedValueOnce({
      period_id: 38,
      period_month: 1,
      period_year: 2026,
      status: 'CLOSED',
    });
    (SnapshotRepository.findPayoutsForSnapshot as jest.Mock).mockResolvedValueOnce([
      { total_payable: '2000.00', department: 'A' },
      { total_payable: '1500.00', department: 'A' },
      { total_payable: '500.00', department: 'B' },
    ]);

    const { processSnapshotOutboxBatch, SnapshotType } = await import('@/modules/snapshot/services/snapshot.service.js');
    const result = await processSnapshotOutboxBatch(10);

    expect(SnapshotRepository.createSnapshot).toHaveBeenNthCalledWith(
      1,
      38,
      SnapshotType.PAYOUT,
      expect.any(Array),
      3,
      4000,
      conn,
    );
    expect(SnapshotRepository.createSnapshot).toHaveBeenNthCalledWith(
      2,
      38,
      SnapshotType.SUMMARY,
      expect.objectContaining({
        period_id: 38,
        total_employees: 3,
        total_amount: 4000,
      }),
      3,
      4000,
      conn,
    );
    expect(SnapshotRepository.setPeriodSnapshotReady).toHaveBeenCalledWith({
      periodId: 38,
      frozenBy: 77,
      conn,
    });
    expect(result).toEqual({ processed: 1, sent: 1, failed: 0, requeued: 0 });
  });
});

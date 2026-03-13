const mockNotifyUser = jest.fn();
const mockEmitAuditEvent = jest.fn();
const mockFindActiveHeadScopes = jest.fn();
const mockFindNonAdminUsers = jest.fn();
const mockGetConnection = jest.fn();
const mockFindActiveCycleByQuarterYear = jest.fn();
const mockFindCycleByQuarterYear = jest.fn();
const mockCreateCycle = jest.fn();
const mockFindCycleById = jest.fn();
const mockCreateItemIfNotExists = jest.fn();
const mockCountItemsByCycle = jest.fn();
const mockUpdateCycleTotalUsers = jest.fn();
const mockUpdateCycleStats = jest.fn();
const mockFindAdminUsers = jest.fn();
const mockUpsertQueueDetection = jest.fn();
const mockAutoResolveUnseenQueueByBatch = jest.fn();
const mockFindSyncBatchStartedAt = jest.fn();
const mockResolveQueueItem = jest.fn();

jest.mock('@/modules/notification/services/notification.service.js', () => ({
  __esModule: true,
  NotificationService: {
    notifyUser: mockNotifyUser,
  },
}));

jest.mock('@/modules/audit/services/audit.service.js', () => ({
  __esModule: true,
  AuditEventType: {
    ACCESS_REVIEW_CREATE: 'ACCESS_REVIEW_CREATE',
  },
  emitAuditEvent: mockEmitAuditEvent,
}));

jest.mock('@/modules/identity/services/identity-role-policy.service.js', () => ({
  __esModule: true,
  IdentityRolePolicyService: {
    PROTECTED_ROLES: new Set<string>(['ADMIN', 'PTS_OFFICER']),
    deriveRole: jest.fn(() => 'DEPT_SCOPE'),
  },
}));

jest.mock('@/modules/identity/repositories/identity-role-policy.repository.js', () => ({
  __esModule: true,
  IdentityRolePolicyRepository: {
    findActiveHeadScopes: mockFindActiveHeadScopes,
  },
}));

jest.mock('@/modules/access-review/repositories/access-review.repository.js', () => ({
  __esModule: true,
  AccessReviewRepository: {
    getConnection: mockGetConnection,
    findNonAdminUsers: mockFindNonAdminUsers,
    findActiveCycleByQuarterYear: mockFindActiveCycleByQuarterYear,
    findCycleByQuarterYear: mockFindCycleByQuarterYear,
    createCycle: mockCreateCycle,
    findCycleById: mockFindCycleById,
    createItemIfNotExists: mockCreateItemIfNotExists,
    countItemsByCycle: mockCountItemsByCycle,
    updateCycleTotalUsers: mockUpdateCycleTotalUsers,
    updateCycleStats: mockUpdateCycleStats,
    findAdminUsers: mockFindAdminUsers,
    upsertQueueDetection: mockUpsertQueueDetection,
    autoResolveUnseenQueueByBatch: mockAutoResolveUnseenQueueByBatch,
    findSyncBatchStartedAt: mockFindSyncBatchStartedAt,
    resolveQueueItem: mockResolveQueueItem,
  },
}));

describe('access review role mismatch policy', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('does not flag role mismatch when derived head role has no active scope map', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    mockGetConnection.mockResolvedValue(connection);
    mockFindActiveCycleByQuarterYear.mockResolvedValue({
      cycle_id: 7,
      status: 'IN_PROGRESS',
    });
    mockFindNonAdminUsers.mockResolvedValue([
      {
        id: 46759,
        citizen_id: '3539900251547',
        role: 'USER',
        is_active: 1,
        employee_status: 'ปฏิบัติงาน (ตรง จ.)',
        last_login_at: null,
        created_at: '2025-01-01T00:00:00.000Z',
        profile_synced_at: '2025-01-01T00:00:00.000Z',
        special_position:
          'รักษาการหัวหน้ากลุ่มภารกิจ-ภารกิจด้านการพยาบาล,หัวหน้ากลุ่มงาน-กลุ่มงานการพยาบาลผู้ป่วยออร์โธปิดิกส์',
        position_name: 'พยาบาลวิชาชีพ',
        department: 'กลุ่มงานการพยาบาลผู้ป่วยออร์โธปิดิกส์',
        sub_department: 'หอผู้ป่วยศัลยกรรมกระดูกชาย (ศกช.)',
      },
    ]);
    mockFindActiveHeadScopes.mockResolvedValue([]);
    mockCreateItemIfNotExists.mockResolvedValue(true);
    mockCountItemsByCycle.mockResolvedValue(0);
    mockFindAdminUsers.mockResolvedValue([]);

    const { refreshReviewCycleFromSync } = await import(
      '@/modules/access-review/services/access-review.service.js'
    );

    const result = await refreshReviewCycleFromSync();

    expect(result.insertedItems).toBe(0);
    expect(mockCreateItemIfNotExists).not.toHaveBeenCalled();
    expect(mockUpsertQueueDetection).not.toHaveBeenCalled();
  });

  test('resolves multiple queue items in a single transaction', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    mockGetConnection.mockResolvedValue(connection);
    mockResolveQueueItem.mockResolvedValue(undefined);

    const mod = await import('@/modules/access-review/services/access-review.service.js');
    const resolveMany =
      (mod as unknown as {
        resolveAccessReviewQueueItems?: (params: {
          queueIds: number[];
          actorId: number;
          action: 'RESOLVE' | 'DISMISS';
          note?: string | null;
        }) => Promise<{ updatedCount: number }>;
    }).resolveAccessReviewQueueItems;

    expect(resolveMany).toBeDefined();
    if (!resolveMany) {
      throw new Error('resolveAccessReviewQueueItems should be defined');
    }

    const result = await resolveMany({
      queueIds: [101, 102, 103],
      actorId: 7,
      action: 'RESOLVE',
      note: 'bulk close',
    });

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(mockResolveQueueItem).toHaveBeenCalledTimes(3);
    expect(mockResolveQueueItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        queueId: 101,
        actorId: 7,
        note: 'bulk close',
      }),
    );
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ updatedCount: 3 });
  });
});

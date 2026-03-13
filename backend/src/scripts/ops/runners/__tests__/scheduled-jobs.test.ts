jest.mock('@/modules/workforce-compliance/services/jobs/index.js', () => ({
  runLicenseAutoCutRestore: jest.fn(),
  runRetirementCutoff: jest.fn(),
  runMovementOutCutoff: jest.fn(),
  runSLADigest: jest.fn(),
  runLeaveReportAlerts: jest.fn(),
}));

jest.mock('@/modules/backup/services/backup.service.js', () => ({
  runBackupJob: jest.fn(),
  shouldRunScheduledBackup: jest.fn(),
}));

jest.mock('@/modules/workforce-compliance/services/license-compliance.digest.service.js', () => ({
  sendLicenseAlertDigest: jest.fn(),
}));

jest.mock('@/modules/notification/services/notification-outbox.service.js', () => ({
  NotificationOutboxService: {
    processBatch: jest.fn(),
  },
}));

jest.mock('@/modules/snapshot/services/snapshot.service.js', () => ({
  processSnapshotOutboxBatch: jest.fn(),
}));

jest.mock('@/modules/sync/services/sync.service.js', () => ({
  SyncService: {
    performFullSync: jest.fn(),
  },
}));

jest.mock('@/modules/sync/services/sync-auto-schedule.service.js', () => ({
  shouldRunAutoSync: jest.fn(),
}));

jest.mock('@/modules/system/services/ops-job-run.service.js', () => ({
  OpsJobRunService: {
    runTrackedJob: jest.fn(async ({ handler }) => handler()),
  },
}));

describe('scheduled jobs runner', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('selectJobs returns defaults when args are empty', async () => {
    const { selectJobs, JOBS } = await import('@/scripts/ops/runners/scheduled-jobs.js');
    expect(selectJobs([])).toEqual(JOBS);
  });

  test('backup job returns skipped summary when not due', async () => {
    const { shouldRunScheduledBackup, runBackupJob } = await import('@/modules/backup/services/backup.service.js');
    (shouldRunScheduledBackup as jest.Mock).mockResolvedValue(false);

    const { runJob } = await import('@/scripts/ops/runners/scheduled-jobs.js');
    const result = await runJob('backup');

    expect(runBackupJob).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'SKIPPED', summary: { reason: 'NOT_DUE' } });
  });

  test('sync job returns skipped summary when schedule says not due', async () => {
    const { shouldRunAutoSync } = await import('@/modules/sync/services/sync-auto-schedule.service.js');
    const { SyncService } = await import('@/modules/sync/services/sync.service.js');
    (shouldRunAutoSync as jest.Mock).mockResolvedValue(false);

    const { runJob } = await import('@/scripts/ops/runners/scheduled-jobs.js');
    const result = await runJob('sync');

    expect(SyncService.performFullSync).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'SKIPPED', summary: { reason: 'NOT_DUE' } });
  });

  test('license-auto-cut job returns success summary', async () => {
    const { runLicenseAutoCutRestore } = await import('@/modules/workforce-compliance/services/jobs/index.js');
    (runLicenseAutoCutRestore as jest.Mock).mockResolvedValue({ cut: 2, restored: 1 });

    const { runJob } = await import('@/scripts/ops/runners/scheduled-jobs.js');
    const result = await runJob('license-auto-cut');

    expect(result).toEqual({ status: 'SUCCESS', summary: { cut: 2, restored: 1 } });
  });
});

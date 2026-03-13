import {
  runLicenseAutoCutRestore,
  runRetirementCutoff,
  runMovementOutCutoff,
  runSLADigest,
  runLeaveReportAlerts,
} from '@/modules/workforce-compliance/services/jobs/index.js';
import {
  runBackupJob,
  shouldRunScheduledBackup,
} from '@/modules/backup/services/backup.service.js';
import { sendLicenseComplianceDigest } from '@/modules/workforce-compliance/services/license-compliance.digest.service.js';
import { NotificationOutboxService } from '@/modules/notification/services/notification-outbox.service.js';
import { OPS_JOB_TIMEZONE } from '@/modules/workforce-compliance/constants/workforce-compliance-policy.js';
import { processSnapshotOutboxBatch } from '@/modules/snapshot/services/snapshot.service.js';
import { SyncService } from '@/modules/sync/services/sync.service.js';
import { shouldRunAutoSync } from '@/modules/sync/services/sync-auto-schedule.service.js';
import { OpsJobRunService } from '@/modules/system/services/ops-job-run.service.js';
import type { TrackedJobResult } from '@/modules/system/services/ops-job-run.service.js';

export type JobName =
  | "sla"
  | "leave-report"
  | "military-leave"
  | "license-auto-cut"
  | "retirement-cut"
  | "movement-cut"
  | "backup"
  | "license-compliance"
  | "notification-outbox"
  | "snapshot-outbox"
  | "sync";

export const JOBS: JobName[] = [
  "sla",
  "leave-report",
  "military-leave",
  "license-auto-cut",
  "retirement-cut",
  // keep as on-demand safety net; not in default run
  // "movement-cut",
  "backup",
  "license-compliance",
  "notification-outbox",
  "snapshot-outbox",
  "sync",
];

type JobHandler = () => Promise<TrackedJobResult>;

const logJobStart = (job: JobName): number => {
  const startedAt = Date.now();
  console.log(`[job:start] ${job}`);
  return startedAt;
};

const logJobDone = (job: JobName, startedAt: number): void => {
  console.log(`[job:done] ${job} duration_ms=${Date.now() - startedAt}`);
};

export const JOB_HANDLERS: Record<JobName, JobHandler> = {
  'sla': async () => {
    const startedAt = logJobStart('sla');
    const result = await runSLADigest();
    console.log('[sla] digest', result);
    logJobDone('sla', startedAt);
    return { status: 'SUCCESS', summary: result };
  },
  'leave-report': async () => {
    const startedAt = logJobStart('leave-report');
    const result = await runLeaveReportAlerts();
    console.log('[leave-report] alerts', result);
    logJobDone('leave-report', startedAt);
    return { status: 'SUCCESS', summary: result };
  },
  'military-leave': async () => {
    const startedAt = logJobStart('military-leave');
    const result = await runLeaveReportAlerts();
    console.log('[leave-report] alerts', result);
    logJobDone('military-leave', startedAt);
    return { status: 'SUCCESS', summary: result };
  },
  'license-auto-cut': async () => {
    const startedAt = logJobStart('license-auto-cut');
    const result = await runLicenseAutoCutRestore();
    console.log('[license-auto-cut] result', result);
    logJobDone('license-auto-cut', startedAt);
    return { status: 'SUCCESS', summary: result };
  },
  'retirement-cut': async () => {
    const startedAt = logJobStart('retirement-cut');
    const result = await runRetirementCutoff();
    console.log('[retirement-cut] result', result);
    logJobDone('retirement-cut', startedAt);
    return { status: 'SUCCESS', summary: { affected: result } };
  },
  'movement-cut': async () => {
    const startedAt = logJobStart('movement-cut');
    const result = await runMovementOutCutoff();
    console.log('[movement-cut] result', result);
    logJobDone('movement-cut', startedAt);
    return { status: 'SUCCESS', summary: { affected: result } };
  },
  'backup': async () => {
    const startedAt = logJobStart('backup');
    const shouldRun = await shouldRunScheduledBackup();
    if (!shouldRun) {
      console.log('[backup] skipped (not scheduled time or already run today)');
      logJobDone('backup', startedAt);
      return { status: 'SKIPPED', summary: { reason: 'NOT_DUE' } };
    }
    const result = await runBackupJob({ triggerSource: 'SCHEDULED' });
    console.log('[backup]', result);
    logJobDone('backup', startedAt);
    return { status: 'SUCCESS', summary: result };
  },
  'license-compliance': async () => {
    const startedAt = logJobStart('license-compliance');
    const result = await sendLicenseComplianceDigest();
    console.log('[license-compliance] digest', result);
    logJobDone('license-compliance', startedAt);
    return { status: 'SUCCESS', summary: result };
  },
  'notification-outbox': async () => {
    const startedAt = logJobStart('notification-outbox');
    const result = await NotificationOutboxService.processBatch(200);
    console.log('[notification-outbox]', result);
    logJobDone('notification-outbox', startedAt);
    return { status: 'SUCCESS', summary: result };
  },
  'snapshot-outbox': async () => {
    const startedAt = logJobStart('snapshot-outbox');
    const result = await processSnapshotOutboxBatch(100);
    console.log('[snapshot-outbox]', result);
    logJobDone('snapshot-outbox', startedAt);
    return { status: 'SUCCESS', summary: result };
  },
  'sync': async () => {
    const startedAt = logJobStart('sync');
    const shouldRun = await shouldRunAutoSync();
    if (!shouldRun) {
      console.log('[sync] skipped (not scheduled time or already run in current window)');
      logJobDone('sync', startedAt);
      return { status: 'SKIPPED', summary: { reason: 'NOT_DUE' } };
    }
    const result = await SyncService.performFullSync({ triggeredBy: null });
    console.log('[sync]', result);
    logJobDone('sync', startedAt);
    return { status: 'SUCCESS', summary: result };
  },
};

export async function runJob(job: JobName): Promise<TrackedJobResult> {
  return JOB_HANDLERS[job]();
}

export function selectJobs(args: string[]): JobName[] {
  if (!args.length) return JOBS;
  return args.filter((arg) => JOBS.includes(arg as JobName)) as JobName[];
}

async function main(): Promise<void> {
  console.log(`[jobs] timezone=${OPS_JOB_TIMEZONE}`);
  const selected = selectJobs(process.argv.slice(2));

  if (!selected.length) {
    console.error(`No valid jobs specified. Use: ${JOBS.join(", ")}`);
    process.exit(1);
  }

  for (const job of selected) {
    try {
      await OpsJobRunService.runTrackedJob({
        jobKey: job,
        triggerSource: 'SCHEDULED',
        handler: () => runJob(job),
      });
    } catch (error: any) {
      console.error(`[${job}] failed:`, error.message);
    }
  }
}

const isDirectRun = process.env.JEST_WORKER_ID === undefined;

if (isDirectRun) {
  main().catch((error) => {
    console.error("Scheduled jobs runner failed:", error);
    process.exit(1);
  });
}

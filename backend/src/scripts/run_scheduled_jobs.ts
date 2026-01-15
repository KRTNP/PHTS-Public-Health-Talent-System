import { sendSLAReminders } from '../modules/sla/sla.service.js';
import { expireOldDelegations } from '../modules/delegation/delegation.service.js';
import {
  autoDisableTerminatedUsers,
  sendReviewReminders,
} from '../modules/access-review/access-review.service.js';
import {
  runDataQualityChecks,
  autoResolveFixedIssues,
} from '../modules/data-quality/data-quality.service.js';
import { runBackupJob } from '../services/backupService.js';

type JobName =
  | 'sla'
  | 'delegation'
  | 'access-review'
  | 'data-quality'
  | 'backup';

const JOBS: JobName[] = ['sla', 'delegation', 'access-review', 'data-quality', 'backup'];

async function runJob(job: JobName): Promise<void> {
  if (job === 'sla') {
    const result = await sendSLAReminders();
    console.log('[sla] reminders', result);
    return;
  }

  if (job === 'delegation') {
    const count = await expireOldDelegations();
    console.log('[delegation] expired', count);
    return;
  }

  if (job === 'access-review') {
    const disabled = await autoDisableTerminatedUsers();
    const reminders = await sendReviewReminders();
    console.log('[access-review] auto-disable', disabled);
    console.log('[access-review] reminders', reminders);
    return;
  }

  if (job === 'data-quality') {
    const checks = await runDataQualityChecks();
    const resolved = await autoResolveFixedIssues();
    console.log('[data-quality] checks', checks);
    console.log('[data-quality] auto-resolve', resolved);
    return;
  }

  if (job === 'backup') {
    const result = await runBackupJob();
    console.log('[backup]', result);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const selected = args.length
    ? args.filter((arg) => JOBS.includes(arg as JobName)) as JobName[]
    : JOBS;

  if (!selected.length) {
    console.error(`No valid jobs specified. Use: ${JOBS.join(', ')}`);
    process.exit(1);
  }

  for (const job of selected) {
    try {
      await runJob(job);
    } catch (error: any) {
      console.error(`[${job}] failed:`, error.message);
    }
  }
}

main().catch((error) => {
  console.error('Scheduled jobs runner failed:', error);
  process.exit(1);
});

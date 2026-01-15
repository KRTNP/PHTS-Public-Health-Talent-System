import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const BACKUP_ENABLED = process.env.BACKUP_ENABLED === 'true';
const BACKUP_COMMAND = process.env.BACKUP_COMMAND || '';
const BACKUP_WORKDIR = process.env.BACKUP_WORKDIR || process.cwd();
const BACKUP_TIMEOUT_MS = Number(process.env.BACKUP_TIMEOUT_MS || 300000);

export async function runBackupJob(): Promise<{ enabled: boolean; output?: string }> {
  if (!BACKUP_ENABLED) {
    return { enabled: false };
  }

  if (!BACKUP_COMMAND) {
    throw new Error('BACKUP_COMMAND is not configured');
  }

  const result = await execAsync(BACKUP_COMMAND, {
    cwd: BACKUP_WORKDIR,
    timeout: BACKUP_TIMEOUT_MS,
  });

  return { enabled: true, output: result.stdout?.toString() };
}

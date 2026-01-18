import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const BACKUP_ENABLED = process.env.BACKUP_ENABLED === 'true';
const BACKUP_COMMAND = process.env.BACKUP_COMMAND || '';
const BACKUP_ARGS = process.env.BACKUP_ARGS || '';
const BACKUP_WORKDIR = process.env.BACKUP_WORKDIR || process.cwd();
const BACKUP_TIMEOUT_MS = Number(process.env.BACKUP_TIMEOUT_MS || 300000);

export async function runBackupJob(): Promise<{ enabled: boolean; output?: string }> {
  if (!BACKUP_ENABLED) {
    return { enabled: false };
  }

  if (!BACKUP_COMMAND) {
    throw new Error('BACKUP_COMMAND is not configured');
  }

  if (/\s/.test(BACKUP_COMMAND)) {
    throw new Error('BACKUP_COMMAND must be an executable path without spaces');
  }

  if (!path.isAbsolute(BACKUP_COMMAND)) {
    throw new Error('BACKUP_COMMAND must be an absolute path');
  }

  let args: string[] = [];
  if (BACKUP_ARGS) {
    try {
      const parsed = JSON.parse(BACKUP_ARGS);
      if (!Array.isArray(parsed) || !parsed.every((arg) => typeof arg === 'string')) {
        throw new Error('BACKUP_ARGS must be a JSON array of strings');
      }
      args = parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`BACKUP_ARGS must be a JSON array of strings (${message})`);
    }
  }

  const result = await execFileAsync(BACKUP_COMMAND, args, {
    cwd: BACKUP_WORKDIR,
    timeout: BACKUP_TIMEOUT_MS,
  });

  return { enabled: true, output: result.stdout?.toString() };
}

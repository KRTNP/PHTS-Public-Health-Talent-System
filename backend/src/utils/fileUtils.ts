import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const DEFAULT_ALLOWED_DIRS = [
  path.join(UPLOAD_ROOT, 'documents'),
  path.join(UPLOAD_ROOT, 'signatures'),
];

function resolveUploadPath(filePath: string, allowedDirs: string[]): string | null {
  const resolvedTarget = path.resolve(filePath);

  for (const dir of allowedDirs) {
    const resolvedBase = path.resolve(dir);
    const relative = path.relative(resolvedBase, resolvedTarget);

    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      return resolvedTarget;
    }
  }

  return null;
}

export async function readUploadFile(
  filePath: string,
  allowedDirs: string[] = [path.join(UPLOAD_ROOT, 'signatures')],
): Promise<Buffer> {
  const safePath = resolveUploadPath(filePath, allowedDirs);
  if (!safePath) {
    throw new Error('Invalid upload path');
  }

  return await readFile(safePath);
}

export function safeUnlinkUpload(
  filePath: string,
  allowedDirs: string[] = DEFAULT_ALLOWED_DIRS,
): boolean {
  const safePath = resolveUploadPath(filePath, allowedDirs);
  if (!safePath) {
    return false;
  }

  fs.unlinkSync(safePath);
  return true;
}

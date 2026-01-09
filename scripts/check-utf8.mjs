import fs from 'fs';
import path from 'path';

const root = process.cwd();
const allowedExts = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.env',
]);
const skipDirs = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.turbo',
  '.cache',
]);

const decoder = new TextDecoder('utf-8', { fatal: true });
const mojibakePatterns = [/à¸/g, /à¹/g, /\uFFFD/g];
const controlChars = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

const issues = [];

function isBinary(buffer) {
  return buffer.includes(0);
}

function checkFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (isBinary(buffer)) {
    return;
  }

  let text = '';
  try {
    text = decoder.decode(buffer);
  } catch (error) {
    issues.push({ filePath, reason: 'Invalid UTF-8 encoding' });
    return;
  }

  if (controlChars.test(text)) {
    issues.push({ filePath, reason: 'Unexpected control characters' });
  }

  for (const pattern of mojibakePatterns) {
    if (pattern.test(text)) {
      issues.push({ filePath, reason: 'Possible mojibake (wrong encoding)' });
      break;
    }
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) {
        continue;
      }
      walk(path.join(dir, entry.name));
      continue;
    }

    const ext = path.extname(entry.name);
    if (!allowedExts.has(ext)) {
      continue;
    }
    checkFile(path.join(dir, entry.name));
  }
}

walk(root);

if (issues.length) {
  console.error('Encoding check failed. Fix the following files:');
  for (const issue of issues) {
    const rel = path.relative(root, issue.filePath);
    console.error(`- ${rel}: ${issue.reason}`);
  }
  process.exit(1);
}

console.log('Encoding check passed.');

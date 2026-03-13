import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';
import { runLocalTesseract } from '@/modules/ocr/services/ocr-local-tesseract.service.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const repoRoot = path.resolve(process.cwd(), '..');
const inputDir = process.env.OCR_BENCHMARK_INPUT_DIR || path.join(repoRoot, 'ocr', 'original_file');
const outputPath =
  process.env.OCR_BENCHMARK_OUTPUT_PATH ||
  path.join(repoRoot, 'ocr', 'output_text', 'OCR_tesseract_local_tuned.txt');

const supportedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

const isSupportedFile = (fileName: string): boolean =>
  supportedExtensions.has(path.extname(fileName).toLowerCase());

const toDocumentBlock = (name: string, text: string): string =>
  `====================\nเอกสาร: ${name}\n\n${text.trim()}\n`;

const run = async (): Promise<void> => {
  const allFiles = await readdir(inputDir);
  const fileNames = allFiles
    .filter(isSupportedFile)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (fileNames.length === 0) {
    throw new Error(`No supported OCR files found in ${inputDir}`);
  }

  const blocks: string[] = [];
  const stats: Array<{ name: string; ms: number; chars: number }> = [];

  for (const fileName of fileNames) {
    const filePath = path.join(inputDir, fileName);
    const buffer = await readFile(filePath);
    const startedAt = performance.now();
    const result = await runLocalTesseract(fileName, buffer);
    const elapsedMs = performance.now() - startedAt;

    if (!result.ok) {
      throw new Error(`OCR failed for ${fileName}: ${result.error || 'Unknown error'}`);
    }

    const markdown = result.markdown || '';
    blocks.push(toDocumentBlock(fileName, markdown));
    stats.push({ name: fileName, ms: elapsedMs, chars: markdown.length });
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${blocks.join('\n')}\n`, 'utf8');

  const totalMs = stats.reduce((sum, item) => sum + item.ms, 0);
  const totalChars = stats.reduce((sum, item) => sum + item.chars, 0);
  console.log(`Tesseract OCR benchmark finished: ${stats.length} files`);
  console.log(`Output: ${outputPath}`);
  console.log(`Total time: ${Math.round(totalMs)} ms, total chars: ${totalChars}`);
  for (const item of stats) {
    console.log(`- ${item.name}: ${Math.round(item.ms)} ms, ${item.chars} chars`);
  }
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[ocr-tesseract-benchmark] ${message}`);
  process.exitCode = 1;
});

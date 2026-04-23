import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { OcrBatchResultItem } from "@/modules/ocr/entities/ocr-precheck.entity.js";
import { enrichOcrBatchResult } from "@/modules/ocr/services/ocr-analysis.service.js";
import { getOcrTesseractConfig } from "@config/runtime-config.js";

const execFile = promisify(execFileCallback);
const isPdf = (fileName: string): boolean =>
  fileName.toLowerCase().endsWith(".pdf");

const preprocessWithImageMagick = async (
  imagePath: string,
  outputPath: string,
): Promise<string> => {
  await execFile("convert", [
    imagePath,
    '-colorspace',
    'Gray',
    '-deskew',
    '40%',
    '-normalize',
    '-contrast-stretch',
    '1%x1%',
    '-sharpen',
    '0x1.0',
    outputPath,
  ]);
  return outputPath;
};

const runTesseractOnImage = async (imagePath: string): Promise<string> => {
  const ocrConfig = getOcrTesseractConfig();
  const preprocessMode = ocrConfig.preprocessMode;
  let inputPath = imagePath;
  if (preprocessMode === 'gray-deskew') {
    const preprocessedPath = `${imagePath}.pre.png`;
    try {
      inputPath = await preprocessWithImageMagick(imagePath, preprocessedPath);
    } catch {
      inputPath = imagePath;
    }
  }

  const tesseractLang = ocrConfig.lang;
  const tesseractOem = ocrConfig.oem;
  const tesseractPsm = ocrConfig.psm;
  const args: string[] = [
    inputPath,
    'stdout',
    '-l',
    tesseractLang,
    '--oem',
    tesseractOem,
    '--psm',
    tesseractPsm,
    '-c',
    'preserve_interword_spaces=1',
  ];
  const thresholdingMethod = ocrConfig.thresholdingMethod;
  if (thresholdingMethod !== null) {
    args.push('-c', `thresholding_method=${thresholdingMethod}`);
  }
  const thresholdingWindowSize = ocrConfig.thresholdingWindowSize;
  if (thresholdingWindowSize !== null) {
    args.push('-c', `thresholding_window_size=${thresholdingWindowSize}`);
  }
  const thresholdingKFactor = ocrConfig.thresholdingKFactor;
  if (thresholdingKFactor !== null) {
    args.push('-c', `thresholding_kfactor=${thresholdingKFactor}`);
  }

  const { stdout } = await execFile('tesseract', args, {
    env: {
      ...process.env,
      OMP_THREAD_LIMIT: ocrConfig.threadLimit,
    },
  });
  return stdout.trim();
};

const renderPdfPages = async (
  pdfPath: string,
  outputPrefix: string,
): Promise<string[]> => {
  await execFile("pdftoppm", [
    "-r",
    getOcrTesseractConfig().pdfDpi,
    "-png",
    pdfPath,
    outputPrefix,
  ]);
  const dir = path.dirname(outputPrefix);
  const base = path.basename(outputPrefix);
  const files = await readdir(dir);
  return files
    .filter((file) => file.startsWith(`${base}-`) && file.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((file) => path.join(dir, file));
};

export const runLocalTesseract = async (
  fileName: string,
  fileBuffer: Buffer,
): Promise<OcrBatchResultItem> => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'phts-ocr-local-'));
  try {
    const tempInputPath = path.join(tempDir, fileName);
    await writeFile(tempInputPath, fileBuffer);

    let markdown = '';
    if (isPdf(fileName)) {
      const pages = await renderPdfPages(tempInputPath, path.join(tempDir, 'page'));
      const pageTexts: string[] = [];
      for (const page of pages) {
        pageTexts.push(await runTesseractOnImage(page));
      }
      markdown = pageTexts.filter(Boolean).join('\n\n');
    } else {
      markdown = await runTesseractOnImage(tempInputPath);
    }

    return enrichOcrBatchResult({
      name: fileName,
      ok: true,
      markdown,
      engine_used: LOCAL_ENGINE_NAME,
      fallback_used: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OCR error';
    if (
      message.includes('spawn tesseract ENOENT') ||
      message.includes('spawn pdftoppm ENOENT')
    ) {
      throw new Error('OCR_MAIN_SERVICE_UNAVAILABLE');
    }
    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
};

import type { NextFunction, Request, Response } from "express";
import { basename, dirname, extname, resolve } from "node:path";
import { readFile, rm } from "node:fs/promises";
import { ValidationError } from "@shared/utils/errors.js";

const UPLOAD_ROOT = resolve(process.cwd(), "uploads");
const DOCUMENT_UPLOAD_ROOT = resolve(process.cwd(), "uploads/documents");
const PDF_SIGNATURE = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const JPEG_SOI = Buffer.from([0xff, 0xd8, 0xff]);

const UPLOAD_TYPE_BY_EXTENSION: Record<string, "application/pdf" | "image/png" | "image/jpeg"> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const INLINE_PREVIEW_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);
const UPLOAD_SESSION_REGEX = /^[a-f0-9-]{36}$/i;
const UPLOAD_FILENAME_REGEX = /^[a-zA-Z0-9._-]{1,180}$/;

type UploadedRequestFile =
  | Express.Multer.File
  | undefined
  | null;

function bufferStartsWith(buffer: Buffer, signature: Buffer): boolean {
  if (buffer.length < signature.length) return false;
  return buffer.subarray(0, signature.length).equals(signature);
}

function detectMimeFromBuffer(
  buffer: Buffer,
): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (bufferStartsWith(buffer, PDF_SIGNATURE)) return "application/pdf";
  if (bufferStartsWith(buffer, PNG_SIGNATURE)) return "image/png";
  if (bufferStartsWith(buffer, JPEG_SOI)) return "image/jpeg";
  return null;
}

function normalizeExtension(fileName: string): string {
  return extname(String(fileName ?? "").trim()).toLowerCase();
}

function normalizeMimeType(value: string | undefined): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  return normalized;
}

function isWithinAllowedUploadRoot(targetPath: string): boolean {
  const resolved = resolve(targetPath);
  return (
    resolved === UPLOAD_ROOT ||
    resolved.startsWith(`${UPLOAD_ROOT}/`) ||
    resolved.startsWith(`${UPLOAD_ROOT}\\`)
  );
}

function isWithinDocumentUploadRoot(targetPath: string): boolean {
  const resolved = resolve(targetPath);
  return (
    resolved === DOCUMENT_UPLOAD_ROOT ||
    resolved.startsWith(`${DOCUMENT_UPLOAD_ROOT}/`) ||
    resolved.startsWith(`${DOCUMENT_UPLOAD_ROOT}\\`)
  );
}

function assertSafeDocumentPath(targetPath: string): string {
  const resolved = resolve(targetPath);
  if (!isWithinAllowedUploadRoot(resolved) || !isWithinDocumentUploadRoot(resolved)) {
    throw new ValidationError("Invalid upload file path.");
  }
  return resolved;
}

function resolveSafeStoredUploadPath(file: Express.Multer.File): string {
  const safeDirectory = assertSafeDocumentPath(file.destination || "");
  const sessionDir = basename(safeDirectory);
  if (!UPLOAD_SESSION_REGEX.test(sessionDir)) {
    throw new ValidationError("Invalid upload session path.");
  }

  const safeFilename = String(file.filename || "").trim();
  if (
    !safeFilename ||
    !UPLOAD_FILENAME_REGEX.test(safeFilename) ||
    safeFilename.includes("..")
  ) {
    throw new ValidationError("Invalid upload filename.");
  }

  const reconstructedDirectory = resolve(DOCUMENT_UPLOAD_ROOT, sessionDir);
  const safePath = resolve(reconstructedDirectory, safeFilename);
  if (
    !isWithinDocumentUploadRoot(safePath) ||
    dirname(safePath) !== reconstructedDirectory
  ) {
    throw new ValidationError("Invalid upload file path.");
  }
  return safePath;
}

function flattenUploadedFiles(req: Request): Express.Multer.File[] {
  const requestWithFiles = req as Request & {
    file?: UploadedRequestFile;
    files?:
      | Express.Multer.File[]
      | Record<string, Express.Multer.File[]>;
  };

  const single = requestWithFiles.file ? [requestWithFiles.file] : [];
  const multiple = Array.isArray(requestWithFiles.files)
    ? requestWithFiles.files
    : Object.values(requestWithFiles.files ?? {}).flat();

  return [...single, ...multiple].filter(
    (file): file is Express.Multer.File => Boolean(file?.path),
  );
}

async function cleanupUploadedFiles(files: Express.Multer.File[]): Promise<void> {
  const directories = new Set<string>();

  for (const file of files) {
    if (!file.destination) continue;
    try {
      const safeDirectory = assertSafeDocumentPath(file.destination);
      const sessionDir = basename(safeDirectory);
      if (!UPLOAD_SESSION_REGEX.test(sessionDir)) continue;
      directories.add(resolve(DOCUMENT_UPLOAD_ROOT, sessionDir));
    } catch {
      continue;
    }
  }

  await Promise.all(
    Array.from(directories).map(async (directory) => {
      try {
        const resolvedDirectory = assertSafeDocumentPath(directory);
        if (
          resolvedDirectory === DOCUMENT_UPLOAD_ROOT ||
          !isWithinDocumentUploadRoot(resolvedDirectory)
        ) {
          return;
        }
        await rm(resolvedDirectory, { recursive: true, force: true }).catch(
          () => undefined,
        );
      } catch {
        return;
      }
    }),
  );
}

export async function validateStoredUploadFile(
  file: Express.Multer.File,
): Promise<void> {
  const extension = normalizeExtension(file.originalname);
  const expectedMime = UPLOAD_TYPE_BY_EXTENSION[extension];
  if (!expectedMime) {
    throw new ValidationError("รองรับเฉพาะไฟล์ PDF, JPG และ PNG");
  }

  const safePath = resolveSafeStoredUploadPath(file);
  const declaredMime = normalizeMimeType(file.mimetype);
  const fileBuffer = await readFile(safePath);
  const detectedMime = detectMimeFromBuffer(fileBuffer);

  if (declaredMime && declaredMime !== expectedMime) {
    throw new ValidationError(
      "Invalid file metadata. Uploaded file does not match an allowed PDF/JPG/PNG document.",
    );
  }

  if (!detectedMime || detectedMime !== expectedMime) {
    throw new ValidationError(
      "Invalid file contents. Uploaded file does not match an allowed PDF/JPG/PNG document.",
    );
  }
}

export async function enforceUploadedFilesAreSafe(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const uploadedFiles = flattenUploadedFiles(req);
  if (uploadedFiles.length === 0) {
    next();
    return;
  }

  try {
    for (const file of uploadedFiles) {
      await validateStoredUploadFile(file);
    }
    next();
  } catch (error) {
    await cleanupUploadedFiles(uploadedFiles);
    next(error);
  }
}

export function applyUploadResponseSecurityHeaders(
  res: Response,
  filePath: string,
): void {
  const extension = normalizeExtension(filePath);
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (INLINE_PREVIEW_EXTENSIONS.has(extension)) {
    return;
  }

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${basename(filePath).replace(/"/g, "")}"`,
  );
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none';");
}

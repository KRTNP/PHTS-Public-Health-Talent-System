/**
 * PHTS System - File Upload Configuration
 *
 * Multer configuration for handling file uploads with validation
 *
 * Date: 2025-12-30
 */

import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function ensureDirectoryExists(
  uploadPath: string,
  cb: (err: Error | null) => void,
) {
  try {
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null);
  } catch (err) {
    cb(err as Error);
  }
}

function buildSafeFilename(
  originalName: string,
  timestamp: number,
): string {
  const extension = path.extname(String(originalName || "")).toLowerCase();
  const safeExtension = [".pdf", ".png", ".jpg", ".jpeg"].includes(extension)
    ? extension
    : ".bin";
  const entropy = crypto.randomBytes(12).toString("hex");
  return `${timestamp}_${entropy}${safeExtension}`;
}

/**
 * Allowed MIME types for file uploads
 */
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
]);

/**
 * Maximum file size: 5MB in bytes
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Configure disk storage for document file uploads
 * Files are stored in uploads/documents/ directory
 */
const documentStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    // Store files in uploads/documents/ relative to backend root
    const uploadPath = path.join(process.cwd(), "uploads/documents");
    ensureDirectoryExists(uploadPath, (err) => cb(err, uploadPath));
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    void req;
    // Generate random filename with allowed extension only.
    const timestamp = Date.now();
    const filename = buildSafeFilename(file.originalname, timestamp);

    cb(null, filename);
  },
});

/**
 * File filter function to validate file types
 * Only allows PDF, JPEG, and PNG files
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void => {
  // Check if MIME type is allowed
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    // Reject file with error message
    cb(
      new Error(
        `Invalid file type. Only PDF, JPEG, and PNG files are allowed. Received: ${file.mimetype}`,
      ),
    );
  }
};

/**
 * Multer upload configuration for documents
 *
 * Features:
 * - Disk storage with custom naming convention
 * - File type validation (PDF, JPEG, PNG only)
 * - 5MB file size limit
 * - Organized storage in uploads/documents/
 */
export const upload = multer({
  storage: documentStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Maximum 10 files per request
  },
});

/**
 * Combined upload middleware for request form
 * Handles document files only (signature uploads removed)
 */
const requestDocumentStorage = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb) => {
    const request = req as Request & { uploadSessionId?: string };
    const uploadRoot = path.join(process.cwd(), "uploads/documents");
    const sessionId = request.uploadSessionId ?? crypto.randomUUID();
    request.uploadSessionId = sessionId;
    const uploadPath = path.join(uploadRoot, sessionId);
    ensureDirectoryExists(uploadPath, (err) => cb(err, uploadPath));
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    void req;
    const timestamp = Date.now();
    const filename = buildSafeFilename(file.originalname, timestamp);
    cb(null, filename);
  },
});

export const requestUpload = multer({
  storage: requestDocumentStorage,
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      // Documents allow PDF and images
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Only PDF, JPEG, and PNG files are allowed.`,
        ),
      );
    }
  },
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 12, // 10 documents + 1 license + 1 signature
  },
});

/**
 * Upload error handler middleware
 * Provides user-friendly error messages for upload failures
 */
export function handleUploadError(error: any): string {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return `File size exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return "Too many files. Maximum 10 files allowed per upload";
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return "Unexpected file field name";
    }
    return `Upload error: ${error.message}`;
  }

  if (error.message?.includes("Invalid file type")) {
    return error.message;
  }

  return "An error occurred during file upload";
}

export default upload;

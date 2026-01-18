/**
 * PHTS System - File Upload Configuration
 *
 * Multer configuration for handling file uploads with validation
 *
 * Date: 2025-12-30
 */

import multer, { FileFilterCallback, StorageEngine } from 'multer';
import { Request } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function ensureDirectoryExists(uploadPath: string, cb: (err: Error | null) => void) {
  try {
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null);
  } catch (err) {
    cb(err as Error);
  }
}

/**
 * Allowed MIME types for file uploads
 */
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']);
const SIGNATURE_MIME_TYPES = new Set(['image/png', 'image/jpeg']);

/**
 * Maximum file size: 5MB in bytes
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Configure disk storage for document file uploads
 * Files are stored in uploads/documents/ directory
 */
const documentStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    // Store files in uploads/documents/ relative to backend root
    const uploadPath = path.join(process.cwd(), 'uploads/documents');
    ensureDirectoryExists(uploadPath, (err) => cb(err, uploadPath));
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Get user ID from authenticated request
    const userId = req.user?.userId || 'anonymous';

    // Generate filename: {userId}_{timestamp}_{originalname}
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname.replaceAll(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${userId}_${timestamp}_${sanitizedOriginalName}`;

    cb(null, filename);
  },
});

/**
 * Configure disk storage for signature uploads
 * Signatures are stored in uploads/signatures/ directory
 */
const signatureStorage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    // Store signatures in uploads/signatures/ relative to backend root
    const uploadPath = path.join(process.cwd(), 'uploads/signatures');
    ensureDirectoryExists(uploadPath, (err) => cb(err, uploadPath));
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Get user ID from authenticated request
    const userId = req.user?.userId || 'anonymous';

    // Preserve original extension when available for better debugging
    const extension = path.extname(file.originalname) || '.png';
    // Generate filename: signature_{userId}_{timestamp}{ext}
    const timestamp = Date.now();
    const filename = `signature_${userId}_${timestamp}${extension}`;

    cb(null, filename);
  },
});

type InternalStorageEngine = StorageEngine & {
  _handleFile: (
    req: Request,
    file: Express.Multer.File,
    cb: (error?: any, info?: Partial<Express.Multer.File>) => void
  ) => void;
  _removeFile: (req: Request, file: Express.Multer.File, cb: (error: Error | null) => void) => void;
};

class MixedRequestStorage implements StorageEngine {
  private readonly documentStorage: InternalStorageEngine;
  private readonly signatureStorage: InternalStorageEngine;

  constructor(documentStore: StorageEngine, signatureStore: StorageEngine) {
    this.documentStorage = documentStore as InternalStorageEngine;
    this.signatureStorage = signatureStore as InternalStorageEngine;
  }

  _handleFile(
    req: Request,
    file: Express.Multer.File,
    cb: (error?: any, info?: Partial<Express.Multer.File>) => void
  ): void {
    if (file.fieldname === 'applicant_signature') {
      this.signatureStorage._handleFile(req, file, cb);
      return;
    }

    this.documentStorage._handleFile(req, file, cb);
  }

  _removeFile(req: Request, file: Express.Multer.File, cb: (error: Error | null) => void): void {
    if (file.fieldname === 'applicant_signature') {
      this.signatureStorage._removeFile(req, file, cb);
      return;
    }

    this.documentStorage._removeFile(req, file, cb);
  }
}

/**
 * File filter function to validate file types
 * Only allows PDF, JPEG, and PNG files
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  // Check if MIME type is allowed
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    // Reject file with error message
    cb(
      new Error(
        `Invalid file type. Only PDF, JPEG, and PNG files are allowed. Received: ${file.mimetype}`
      )
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
 * Multer upload configuration for signatures
 *
 * Features:
 * - Disk storage in uploads/signatures/
 * - Only PNG images allowed
 * - 2MB file size limit for signatures
 */
export const signatureUpload = multer({
  storage: signatureStorage,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Only allow PNG images for signatures
    if (SIGNATURE_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Signature must be a PNG or JPEG image'));
    }
  },
  limits: {
    fileSize: MAX_SIGNATURE_SIZE, // 2MB for signatures
    files: 1, // Only one signature per request
  },
});

/**
 * Combined upload middleware for request form
 * Handles both document files and signature
 */
const requestDocumentStorage = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb) => {
    const request = req as Request & { uploadSessionId?: string };
    const uploadRoot = path.join(process.cwd(), 'uploads/documents');
    const sessionId = request.uploadSessionId ?? crypto.randomUUID();
    request.uploadSessionId = sessionId;
    const uploadPath = path.join(uploadRoot, sessionId);
    ensureDirectoryExists(uploadPath, (err) => cb(err, uploadPath));
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const userId = req.user?.userId || 'anonymous';
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname.replaceAll(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${userId}_${timestamp}_${sanitizedOriginalName}`;
    cb(null, filename);
  },
});

const requestSignatureStorage = multer.memoryStorage();

export const requestUpload = multer({
  storage: new MixedRequestStorage(requestDocumentStorage, requestSignatureStorage),
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.fieldname === 'applicant_signature') {
      // Signatures only allow PNG/JPEG
      if (SIGNATURE_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Signature must be a PNG or JPEG image'));
      }
    } else if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      // Documents allow PDF and images
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only PDF, JPEG, and PNG files are allowed.`));
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
    if (error.code === 'LIMIT_FILE_SIZE') {
      return `File size exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return 'Too many files. Maximum 10 files allowed per upload';
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return 'Unexpected file field name';
    }
    return `Upload error: ${error.message}`;
  }

  if (error.message?.includes('Invalid file type')) {
    return error.message;
  }

  return 'An error occurred during file upload';
}

export default upload;

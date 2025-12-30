/**
 * PHTS System - File Upload Configuration
 *
 * Multer configuration for handling file uploads with validation
 *
 * Date: 2025-12-30
 */

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import '../types/express.js';

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Allowed MIME types for file uploads
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
];

/**
 * Maximum file size: 5MB in bytes
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Configure disk storage for file uploads
 * Files are stored in uploads/documents/ directory
 */
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    // Store files in uploads/documents/ relative to backend root
    const uploadPath = path.join(__dirname, '../../uploads/documents');
    cb(null, uploadPath);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Get user ID from authenticated request
    const userId = req.user?.userId || 'anonymous';

    // Generate filename: {userId}_{timestamp}_{originalname}
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${userId}_${timestamp}_${sanitizedOriginalName}`;

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
  cb: FileFilterCallback
): void => {
  // Check if MIME type is allowed
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
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
 * Multer upload configuration
 *
 * Features:
 * - Disk storage with custom naming convention
 * - File type validation (PDF, JPEG, PNG only)
 * - 5MB file size limit
 * - Organized storage in uploads/documents/
 */
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 10, // Maximum 10 files per request
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

  if (error.message && error.message.includes('Invalid file type')) {
    return error.message;
  }

  return 'An error occurred during file upload';
}

export default upload;

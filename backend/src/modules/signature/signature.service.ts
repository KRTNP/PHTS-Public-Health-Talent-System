/**
 * PHTS System - Signature Service Layer
 *
 * Business logic for managing user digital signatures.
 * Handles storage, retrieval, and conversion of signature images.
 *
 * Date: 2025-12-31
 */

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';
import { query, getConnection } from '../../config/database.js';

/**
 * User signature entity from database
 */
export interface UserSignature {
  signature_id: number;
  user_id: number;
  signature_image: Buffer;
  created_at: Date;
  updated_at: Date;
}

/**
 * Signature response for API
 */
export interface SignatureResponse {
  user_id: number;
  image_base64: string;
  mime_type: string;
  created_at: Date;
}

/**
 * Get a user's stored signature as Base64
 *
 * @param userId - ID of the user
 * @returns Signature data with Base64 encoded image, or null if not found
 */
export async function getSignatureByUserId(userId: number): Promise<SignatureResponse | null> {
  const rows = await query<RowDataPacket[]>(
    `SELECT signature_id, user_id, signature_image, created_at, updated_at
     FROM sig_images
     WHERE user_id = ?`,
    [userId],
  );

  if (rows.length === 0) {
    return null;
  }

  const signature = rows[0] as UserSignature;

  // Convert LONGBLOB to Base64
  const base64Image = signature.signature_image.toString('base64');

  // Detect image type from magic bytes
  const mimeType = detectImageType(signature.signature_image);

  return {
    user_id: signature.user_id,
    image_base64: base64Image,
    mime_type: mimeType,
    created_at: signature.created_at,
  };
}

/**
 * Get signature as data URL (ready for img src)
 *
 * @param userId - ID of the user
 * @returns Data URL string or null
 */
export async function getSignatureDataUrl(userId: number): Promise<string | null> {
  const signature = await getSignatureByUserId(userId);

  if (!signature) {
    return null;
  }

  return `data:${signature.mime_type};base64,${signature.image_base64}`;
}

/**
 * Save or update a user's signature
 *
 * @param userId - ID of the user
 * @param imageBuffer - Binary image data
 * @returns Created/updated signature ID
 */
export async function saveSignature(
  userId: number,
  imageBuffer: Buffer,
  externalConnection?: PoolConnection,
): Promise<number> {
  const connection = externalConnection || (await getConnection());
  const manageTx = !externalConnection;

  try {
    if (manageTx) await connection.beginTransaction();

    // Check if signature already exists
    const [existing] = await connection.query<RowDataPacket[]>(
      'SELECT signature_id FROM sig_images WHERE user_id = ?',
      [userId],
    );

    let signatureId: number;

    if (existing.length > 0) {
      // Update existing signature
      await connection.execute(
        `UPDATE sig_images
         SET signature_image = ?, updated_at = NOW()
         WHERE user_id = ?`,
        [imageBuffer, userId],
      );
      signatureId = existing[0].signature_id;
    } else {
      // Insert new signature
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO sig_images (user_id, signature_image)
         VALUES (?, ?)`,
        [userId, imageBuffer],
      );
      signatureId = result.insertId;
    }

    if (manageTx) await connection.commit();
    return signatureId;
  } catch (error) {
    if (manageTx) await connection.rollback();
    throw error;
  } finally {
    if (manageTx) connection.release();
  }
}

/**
 * Save signature from Base64 string
 *
 * @param userId - ID of the user
 * @param base64Data - Base64 encoded image (with or without data URL prefix)
 * @returns Created/updated signature ID
 */
export async function saveSignatureFromBase64(userId: number, base64Data: string): Promise<number> {
  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');

  // Convert to Buffer
  const imageBuffer = Buffer.from(base64Clean, 'base64');

  return saveSignature(userId, imageBuffer);
}

/**
 * Delete a user's signature
 *
 * @param userId - ID of the user
 * @returns True if deleted, false if not found
 */
export async function deleteSignature(userId: number): Promise<boolean> {
  const result = await query<ResultSetHeader>('DELETE FROM sig_images WHERE user_id = ?', [
    userId,
  ]);

  return result.affectedRows > 0;
}

/**
 * Check if a user has a stored signature
 *
 * @param userId - ID of the user
 * @returns True if signature exists
 */
export async function hasSignature(userId: number): Promise<boolean> {
  const rows = await query<RowDataPacket[]>(
    'SELECT 1 FROM sig_images WHERE user_id = ? LIMIT 1',
    [userId],
  );

  return rows.length > 0;
}

/**
 * Detect image MIME type from magic bytes
 *
 * @param buffer - Image buffer
 * @returns MIME type string
 */
function detectImageType(buffer: Buffer): string {
  // Check PNG magic bytes: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  // Check JPEG magic bytes: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // Check GIF magic bytes: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }

  // Check WebP magic bytes: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    return 'image/webp';
  }

  // Default to PNG
  return 'image/png';
}

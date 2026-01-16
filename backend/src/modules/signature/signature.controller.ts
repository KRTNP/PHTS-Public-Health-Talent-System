/**
 * PHTS System - Signature Controller
 *
 * HTTP handlers for managing user digital signatures.
 * Enables approvers to store and retrieve their signatures for workflow stamping.
 *
 * Date: 2025-12-31
 */

import { Request, Response } from 'express';
import { ApiResponse } from '../../types/auth.js';
import * as signatureService from './signature.service.js';

/**
 * Response type for signature retrieval
 */
interface SignatureApiResponse {
  user_id: number;
  image_base64: string;
  mime_type: string;
  data_url: string;
  created_at: Date;
}

/**
 * Get current user's stored signature
 *
 * @route GET /api/signatures/my-signature
 * @access Protected
 */
export async function getMySignature(
  req: Request,
  res: Response<ApiResponse<SignatureApiResponse>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const signature = await signatureService.getSignatureByUserId(req.user.userId);

    if (!signature) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบลายเซ็นที่บันทึกไว้',
      });
      return;
    }

    // Build data URL for direct use in img src
    const dataUrl = `data:${signature.mime_type};base64,${signature.image_base64}`;

    res.status(200).json({
      success: true,
      data: {
        user_id: signature.user_id,
        image_base64: signature.image_base64,
        mime_type: signature.mime_type,
        data_url: dataUrl,
        created_at: signature.created_at,
      },
    });
  } catch (error: unknown) {
    console.error('Get signature error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}

/**
 * Check if current user has a stored signature
 *
 * @route GET /api/signatures/check
 * @access Protected
 */
export async function checkSignature(
  req: Request,
  res: Response<ApiResponse<{ has_signature: boolean }>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const hasSignature = await signatureService.hasSignature(req.user.userId);

    res.status(200).json({
      success: true,
      data: {
        has_signature: hasSignature,
      },
    });
  } catch (error: unknown) {
    console.error('Check signature error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}

/**
 * Save or update current user's signature
 *
 * @route POST /api/signatures/upload
 * @access Protected
 * @body { image_base64: string } - Base64 encoded image data
 */
export async function uploadSignature(
  req: Request,
  res: Response<ApiResponse<{ signature_id: number; message: string }>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const { image_base64 } = req.body;

    if (!image_base64 || typeof image_base64 !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Missing image_base64 in request body',
      });
      return;
    }

    // Validate Base64 format
    const base64Regex = /^(data:image\/\w+;base64,)?[A-Za-z0-9+/]+=*$/;
    const cleanBase64 = image_base64.replace(/^data:image\/\w+;base64,/, '');

    if (!base64Regex.test(cleanBase64)) {
      res.status(400).json({
        success: false,
        error: 'Invalid Base64 image format',
      });
      return;
    }

    // Save signature
    const signatureId = await signatureService.saveSignatureFromBase64(
      req.user.userId,
      image_base64
    );

    res.status(200).json({
      success: true,
      data: {
        signature_id: signatureId,
        message: 'บันทึกลายเซ็นสำเร็จ',
      },
    });
  } catch (error: unknown) {
    console.error('Upload signature error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}

/**
 * Save signature from file upload
 *
 * @route POST /api/signatures/upload-file
 * @access Protected
 * @file signature - Image file (PNG, JPEG)
 */
export async function uploadSignatureFile(
  req: Request,
  res: Response<ApiResponse<{ signature_id: number; message: string }>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const file = req.file;

    if (!file) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
      return;
    }

    // Validate file type
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
      res.status(400).json({
        success: false,
        error: 'Invalid file type. Only PNG and JPEG images are allowed.',
      });
      return;
    }

    // Save signature from buffer
    const signatureId = await signatureService.saveSignature(
      req.user.userId,
      file.buffer
    );

    res.status(200).json({
      success: true,
      data: {
        signature_id: signatureId,
        message: 'บันทึกลายเซ็นสำเร็จ',
      },
    });
  } catch (error: unknown) {
    console.error('Upload signature file error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}

/**
 * Delete current user's signature
 *
 * @route DELETE /api/signatures
 * @access Protected
 */
export async function deleteSignature(
  req: Request,
  res: Response<ApiResponse<{ message: string }>>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized access',
      });
      return;
    }

    const deleted = await signatureService.deleteSignature(req.user.userId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบลายเซ็นที่จะลบ',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'ลบลายเซ็นสำเร็จ',
      },
    });
  } catch (error: unknown) {
    console.error('Delete signature error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
}

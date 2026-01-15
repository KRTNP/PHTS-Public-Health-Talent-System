import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { query } from '../../config/database.js';
import { RequestStatus, ROLE_STEP_MAP } from './request.types.js';

export type OcrStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AttachmentOcrRecord {
  ocr_id: number;
  attachment_id: number;
  provider: string;
  status: OcrStatus;
  extracted_json: any | null;
  confidence: number | null;
  error_message: string | null;
  processed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const OCR_ENABLED = process.env.OCR_ENABLED === 'true';
const OCR_PROVIDER = process.env.OCR_PROVIDER || 'TYPHOON';
const OCR_PYTHON_BIN = process.env.OCR_PYTHON_BIN || 'python3';
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS || 120000);
const execFileAsync = promisify(execFile);

export function isOcrEnabled(): boolean {
  return OCR_ENABLED;
}

export async function getOcrRecord(
  attachmentId: number,
): Promise<AttachmentOcrRecord | null> {
  const rows = await query<RowDataPacket[]>(
    'SELECT * FROM pts_attachment_ocr WHERE attachment_id = ? LIMIT 1',
    [attachmentId],
  );

  return (rows[0] as AttachmentOcrRecord) || null;
}

export async function assertOcrAccess(
  attachmentId: number,
  userId: number,
): Promise<void> {
  const rows = await query<RowDataPacket[]>(
    `SELECT r.request_id, r.status, r.current_step, r.assigned_officer_id
     FROM pts_attachments a
     JOIN pts_requests r ON a.request_id = r.request_id
     WHERE a.attachment_id = ? LIMIT 1`,
    [attachmentId],
  );

  if (!rows.length) {
    throw new Error('Attachment not found');
  }

  const row = rows[0] as any;
  const officerStep = ROLE_STEP_MAP['PTS_OFFICER'];

  if (row.status !== RequestStatus.PENDING || row.current_step !== officerStep) {
    throw new Error('Attachment is not at PTS_OFFICER step');
  }

  if (row.assigned_officer_id && row.assigned_officer_id !== userId) {
    throw new Error('Attachment is assigned to another officer');
  }
}

export async function ensureOcrRecord(
  attachmentId: number,
): Promise<AttachmentOcrRecord> {
  const attachments = await query<RowDataPacket[]>(
    'SELECT attachment_id FROM pts_attachments WHERE attachment_id = ? LIMIT 1',
    [attachmentId],
  );
  if (!attachments.length) {
    throw new Error('Attachment not found');
  }

  await query<ResultSetHeader>(
    `INSERT INTO pts_attachment_ocr (attachment_id, provider, status)
     VALUES (?, ?, 'PENDING')
     ON DUPLICATE KEY UPDATE provider = VALUES(provider)`,
    [attachmentId, OCR_PROVIDER],
  );

  const record = await getOcrRecord(attachmentId);
  if (!record) {
    throw new Error('Unable to create OCR record');
  }
  return record;
}

export async function requestOcrProcessing(
  attachmentId: number,
  pageNum?: number,
): Promise<{ record: AttachmentOcrRecord; ocrEnabled: boolean }> {
  const record = await ensureOcrRecord(attachmentId);

  if (!OCR_ENABLED) {
    return { record, ocrEnabled: false };
  }

  const processed = await processAttachmentOcr(attachmentId, pageNum);
  return { record: processed, ocrEnabled: true };
}

async function getAttachmentPath(attachmentId: number): Promise<string> {
  const rows = await query<RowDataPacket[]>(
    'SELECT file_path FROM pts_attachments WHERE attachment_id = ? LIMIT 1',
    [attachmentId],
  );

  if (!rows.length) {
    throw new Error('Attachment not found');
  }

  const filePath = (rows[0] as any).file_path as string;
  if (!filePath) {
    throw new Error('Attachment file path is missing');
  }

  return filePath;
}

async function runTyphoonOcr(
  filePath: string,
  pageNum?: number,
): Promise<{ markdown: string }> {
  const runnerPath = path.resolve(process.cwd(), 'src/scripts/typhoon_ocr_runner.py');
  const args = [runnerPath, filePath];
  if (pageNum) {
    args.push(String(pageNum));
  }

  const { stdout } = await execFileAsync(OCR_PYTHON_BIN, args, {
    timeout: OCR_TIMEOUT_MS,
  });

  const parsed = JSON.parse(stdout || '{}');
  if (!parsed.markdown) {
    throw new Error('OCR output is empty');
  }

  return { markdown: parsed.markdown };
}

async function updateOcrRecord(
  attachmentId: number,
  updates: {
    status?: OcrStatus;
    extracted_json?: any | null;
    confidence?: number | null;
    error_message?: string | null;
    processed_at?: Date | null;
  },
): Promise<void> {
  const fields: string[] = [];
  const params: any[] = [];

  if (updates.status) {
    fields.push('status = ?');
    params.push(updates.status);
  }
  if (updates.extracted_json !== undefined) {
    fields.push('extracted_json = ?');
    params.push(JSON.stringify(updates.extracted_json));
  }
  if (updates.confidence !== undefined) {
    fields.push('confidence = ?');
    params.push(updates.confidence);
  }
  if (updates.error_message !== undefined) {
    fields.push('error_message = ?');
    params.push(updates.error_message);
  }
  if (updates.processed_at !== undefined) {
    fields.push('processed_at = ?');
    params.push(updates.processed_at);
  }

  if (!fields.length) {
    return;
  }

  params.push(attachmentId);
  await query(
    `UPDATE pts_attachment_ocr SET ${fields.join(', ')}, updated_at = NOW() WHERE attachment_id = ?`,
    params,
  );
}

export async function processAttachmentOcr(
  attachmentId: number,
  pageNum?: number,
): Promise<AttachmentOcrRecord> {
  await ensureOcrRecord(attachmentId);
  const filePath = await getAttachmentPath(attachmentId);

  if (!fs.existsSync(filePath)) {
    await updateOcrRecord(attachmentId, {
      status: 'FAILED',
      error_message: 'Attachment file not found on disk',
    });
    throw new Error('Attachment file not found on disk');
  }

  await updateOcrRecord(attachmentId, {
    status: 'PROCESSING',
    error_message: null,
  });

  try {
    const result = await runTyphoonOcr(filePath, pageNum);
    await updateOcrRecord(attachmentId, {
      status: 'COMPLETED',
      extracted_json: { markdown: result.markdown },
      confidence: null,
      processed_at: new Date(),
      error_message: null,
    });
  } catch (error: any) {
    await updateOcrRecord(attachmentId, {
      status: 'FAILED',
      error_message: error.message,
    });
    throw error;
  }

  const updated = await getOcrRecord(attachmentId);
  if (!updated) {
    throw new Error('OCR record not found after processing');
  }

  return updated;
}

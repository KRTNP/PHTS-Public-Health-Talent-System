export const OCR_QUEUE_KEY = 'request:ocr:precheck:queue';
export const OCR_WORKER_BRPOP_TIMEOUT_SEC = 5;

export type OcrQueueJob = {
  requestId: number;
  enqueuedAt: string;
};

export type OcrBatchResultItem = {
  name?: string;
  ok?: boolean;
  markdown?: string;
  error?: string;
  suppressed?: boolean;
  engine_used?: 'tesseract' | 'typhoon' | 'auto' | string;
  fallback_used?: boolean;
  document_kind?: 'license' | 'memo' | 'assignment_order' | 'general' | string;
  fields?: Record<string, unknown>;
  missing_fields?: string[];
  fallback_reason?: string;
  quality?: {
    required_fields?: number;
    captured_fields?: number;
    passed?: boolean;
  };
};

export type OcrBatchResponse = {
  count?: number;
  results?: OcrBatchResultItem[];
};

export type OcrPrecheckStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped';

export type OcrPrecheckRecord = {
  request_id: number;
  status: OcrPrecheckStatus;
  source?: string | null;
  service_url?: string | null;
  worker?: string | null;
  queued_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  count?: number | null;
  success_count?: number | null;
  failed_count?: number | null;
  error?: string | null;
  results?: OcrBatchResultItem[] | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type OcrPrecheckHistoryItem = OcrPrecheckRecord & {
  request_no?: string | null;
  request_status?: string | null;
  request_type?: string | null;
  requester_name?: string | null;
  department?: string | null;
};

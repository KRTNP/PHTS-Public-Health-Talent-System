import type { OcrBatchResultItem, OcrPrecheckRecord } from '@/modules/ocr/entities/ocr-precheck.entity.js';
import { OcrRequestRepository } from '@/modules/ocr/repositories/ocr-request.repository.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';

export type OcrPrecheckScope =
  | { kind: 'request'; id: number }
  | { kind: 'eligibility'; id: number };

type OcrPrecheckSavePayload = {
  status: string;
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
};

type LegacyRequestPrecheckUpdater = (
  requestId: number,
  patch: OcrPrecheckSavePayload,
) => Promise<void>;

const parseEligibilityResults = (row: unknown): OcrBatchResultItem[] => {
  const resultsJson = (row as { results_json?: unknown } | null)?.results_json;
  if (typeof resultsJson !== 'string' || !resultsJson.trim()) {
    return [];
  }
  return JSON.parse(resultsJson) as OcrBatchResultItem[];
};

export const getExistingOcrResults = async (
  scope: OcrPrecheckScope,
): Promise<OcrBatchResultItem[]> => {
  if (scope.kind === 'request') {
    const existing = await OcrRequestRepository.findRequestPrecheck(scope.id);
    return existing?.results ?? [];
  }

  const existing = await requestRepository.findEligibilityOcrPrecheck(scope.id);
  return parseEligibilityResults(existing);
};

export const saveOcrPrecheck = async (
  scope: OcrPrecheckScope,
  payload: OcrPrecheckSavePayload,
): Promise<void> => {
  if (scope.kind === 'request') {
    if (typeof OcrRequestRepository.upsertRequestPrecheck === 'function') {
      await OcrRequestRepository.upsertRequestPrecheck(
        scope.id,
        payload as Partial<OcrPrecheckRecord>,
      );
      return;
    }
    const legacyUpdater = (OcrRequestRepository as { updateRequestPrecheck?: LegacyRequestPrecheckUpdater })
      .updateRequestPrecheck;
    if (typeof legacyUpdater === 'function') {
      await legacyUpdater(
        scope.id,
        payload,
      );
      return;
    }
    return;
  }

  await requestRepository.upsertEligibilityOcrPrecheck(scope.id, payload);
};

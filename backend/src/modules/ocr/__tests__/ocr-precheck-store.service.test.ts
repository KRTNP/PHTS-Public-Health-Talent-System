jest.mock('@/modules/ocr/repositories/ocr-request.repository.js', () => ({
  OcrRequestRepository: {
    findRequestPrecheck: jest.fn(),
    upsertRequestPrecheck: jest.fn(),
  },
}));

jest.mock('@/modules/request/data/repositories/request.repository.js', () => ({
  requestRepository: {
    findEligibilityOcrPrecheck: jest.fn(),
    upsertEligibilityOcrPrecheck: jest.fn(),
  },
}));

import { OcrRequestRepository } from '@/modules/ocr/repositories/ocr-request.repository.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';

describe('ocr precheck store service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads existing OCR results for request scope', async () => {
    (OcrRequestRepository.findRequestPrecheck as jest.Mock).mockResolvedValue({
      results: [{ name: 'memo.pdf', ok: true, markdown: 'text' }],
    });

    const { getExistingOcrResults } = await import(
      '@/modules/ocr/services/ocr-precheck-store.service.js'
    );

    const result = await getExistingOcrResults({ kind: 'request', id: 10 });

    expect(result).toEqual([{ name: 'memo.pdf', ok: true, markdown: 'text' }]);
  });

  it('loads existing OCR results for eligibility scope from results_json', async () => {
    (requestRepository.findEligibilityOcrPrecheck as jest.Mock).mockResolvedValue({
      results_json: JSON.stringify([{ name: 'memo.pdf', ok: true, markdown: 'text' }]),
    });

    const { getExistingOcrResults } = await import(
      '@/modules/ocr/services/ocr-precheck-store.service.js'
    );

    const result = await getExistingOcrResults({ kind: 'eligibility', id: 20 });

    expect(result).toEqual([{ name: 'memo.pdf', ok: true, markdown: 'text' }]);
  });

  it('persists OCR summary for eligibility scope', async () => {
    const { saveOcrPrecheck } = await import(
      '@/modules/ocr/services/ocr-precheck-store.service.js'
    );

    await saveOcrPrecheck(
      { kind: 'eligibility', id: 20 },
      {
        status: 'completed',
        source: 'MANUAL_VERIFY',
        service_url: 'local-tesseract',
        worker: 'server-manual',
        count: 1,
        success_count: 1,
        failed_count: 0,
        error: null,
        results: [{ name: 'memo.pdf', ok: true, markdown: 'text' }],
      },
    );

    expect(requestRepository.upsertEligibilityOcrPrecheck).toHaveBeenCalledWith(
      20,
      expect.objectContaining({
        status: 'completed',
        source: 'MANUAL_VERIFY',
        service_url: 'local-tesseract',
      }),
    );
  });
});

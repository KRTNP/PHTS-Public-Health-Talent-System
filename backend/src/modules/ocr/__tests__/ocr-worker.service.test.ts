jest.mock('@/modules/ocr/repositories/ocr-request.repository.js', () => ({
  OcrRequestRepository: {
    findStaleProcessingRequestIds: jest.fn(),
    upsertRequestPrecheck: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/modules/ocr/services/ocr-precheck.service.js', () => ({
  processRequestOcrPrecheck: jest.fn(),
  enqueueRequestOcrPrecheck: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@config/redis.js', () => ({
  __esModule: true,
  default: {
    duplicate: jest.fn(() => ({
      brpop: jest.fn().mockResolvedValue(null),
      quit: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    })),
  },
}));

import { OcrRequestRepository } from '@/modules/ocr/repositories/ocr-request.repository.js';
import { enqueueRequestOcrPrecheck } from '@/modules/ocr/services/ocr-precheck.service.js';

describe('ocr worker stale recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OCR_STALE_PROCESSING_MINUTES;
  });

  it('returns zero and does not enqueue when no stale processing requests found', async () => {
    (OcrRequestRepository.findStaleProcessingRequestIds as jest.Mock).mockResolvedValue([]);

    const { recoverStaleOcrPrecheckJobs } = await import('@/modules/ocr/services/ocr-worker.service.js');
    const recovered = await recoverStaleOcrPrecheckJobs();

    expect(recovered).toBe(0);
    expect(enqueueRequestOcrPrecheck).not.toHaveBeenCalled();
    expect(OcrRequestRepository.upsertRequestPrecheck).not.toHaveBeenCalled();
  });

  it('requeues stale processing jobs and resets precheck status to queued', async () => {
    process.env.OCR_STALE_PROCESSING_MINUTES = '10';
    (OcrRequestRepository.findStaleProcessingRequestIds as jest.Mock).mockResolvedValue([5, 9]);

    const { recoverStaleOcrPrecheckJobs } = await import('@/modules/ocr/services/ocr-worker.service.js');
    const recovered = await recoverStaleOcrPrecheckJobs();

    expect(recovered).toBe(2);
    expect(OcrRequestRepository.findStaleProcessingRequestIds).toHaveBeenCalledWith(10);
    expect(OcrRequestRepository.upsertRequestPrecheck).toHaveBeenNthCalledWith(
      1,
      5,
      expect.objectContaining({
        status: 'queued',
        started_at: null,
        finished_at: null,
        count: 0,
        success_count: 0,
        failed_count: 0,
      }),
    );
    expect(OcrRequestRepository.upsertRequestPrecheck).toHaveBeenNthCalledWith(
      2,
      9,
      expect.objectContaining({
        status: 'queued',
        started_at: null,
        finished_at: null,
      }),
    );
    expect(enqueueRequestOcrPrecheck).toHaveBeenNthCalledWith(1, 5);
    expect(enqueueRequestOcrPrecheck).toHaveBeenNthCalledWith(2, 9);
  });
});

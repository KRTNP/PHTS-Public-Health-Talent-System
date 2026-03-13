jest.mock('node:fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('file')),
}));

jest.mock('@config/redis.js', () => ({
  __esModule: true,
  default: {
    lpush: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('@/modules/ocr/repositories/ocr-request.repository.js', () => ({
  OcrRequestRepository: {
    updateRequestPrecheck: jest.fn().mockResolvedValue(undefined),
    findAttachments: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/modules/ocr/providers/ocr-http.provider.js', () => ({
  OcrHttpProvider: {
    getServiceBase: jest.fn(),
    getPaddleServiceBase: jest.fn(),
    processSingleFile: jest.fn(),
  },
}));

describe('ocr precheck service', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('marks request as skipped when OCR service is not configured', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('');
    (OcrHttpProvider.getPaddleServiceBase as jest.Mock).mockReturnValue('');

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(10);

    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        status: 'skipped',
      }),
    );
  });

  test('marks request as failed when no attachments are available', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('http://ocr.test');
    (OcrHttpProvider.getPaddleServiceBase as jest.Mock).mockReturnValue('');
    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([]);

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(11);

    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      11,
      expect.objectContaining({
        status: 'failed',
        error: 'No attachments to OCR',
      }),
    );
  });

  test('stores completed result when at least one attachment succeeds', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('http://ocr.test');
    (OcrHttpProvider.getPaddleServiceBase as jest.Mock).mockReturnValue('');
    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([
      { file_type: 'OTHER', file_path: 'uploads/a.pdf', file_name: 'a.pdf' },
    ]);
    (OcrHttpProvider.processSingleFile as jest.Mock).mockResolvedValue({
      ok: true,
      markdown: 'text',
      name: 'a.pdf',
    });

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(12);

    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      12,
      expect.objectContaining({
        status: 'completed',
        success_count: 1,
        failed_count: 0,
      }),
    );
  });

  test('uses fast-first pass and then enhances low quality result with paddle', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('http://ocr.test');
    (OcrHttpProvider.getPaddleServiceBase as jest.Mock).mockReturnValue('http://paddle.test');
    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([
      { file_type: 'OTHER', file_path: 'uploads/a.pdf', file_name: 'a.pdf' },
    ]);
    (OcrHttpProvider.processSingleFile as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        markdown: 'คำสั่งกลุ่มงานเภสัชกรรม\nที่ ๑/ ๒๕๒๐๕\nlow quality',
        name: 'a.pdf',
        quality: { passed: false, required_fields: 3, captured_fields: 1 },
      })
      .mockResolvedValueOnce({
        ok: true,
        markdown: 'better quality',
        name: 'a.pdf',
        engine_used: 'paddle',
        quality: { passed: true, required_fields: 3, captured_fields: 3 },
      });

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(13);

    expect(OcrHttpProvider.processSingleFile).toHaveBeenNthCalledWith(
      1,
      'a.pdf',
      expect.any(Buffer),
      'http://ocr.test',
      expect.objectContaining({
        disableFallbackChain: true,
      }),
    );
    expect(OcrHttpProvider.processSingleFile).toHaveBeenNthCalledWith(
      2,
      'a.pdf',
      expect.any(Buffer),
      'http://paddle.test',
      expect.objectContaining({
        disableFallbackChain: true,
      }),
    );
    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      13,
      expect.objectContaining({
        status: 'completed',
        success_count: 1,
        failed_count: 0,
        results: [
          expect.objectContaining({
            name: 'a.pdf',
            engine_used: 'paddle',
            quality: expect.objectContaining({ passed: true }),
          }),
        ],
      }),
    );
  });

  test('uses paddle enhancement when tesseract markdown contains suspicious old Thai year', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('http://ocr.test');
    (OcrHttpProvider.getPaddleServiceBase as jest.Mock).mockReturnValue('http://paddle.test');
    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([
      { file_type: 'OTHER', file_path: 'uploads/a.pdf', file_name: 'a.pdf' },
    ]);
    (OcrHttpProvider.processSingleFile as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        markdown:
          'คำสั่งกลุ่มงานเภสัชกรรม\nที่ ๑/ ๒๕๒๐๕\nทั้งนี้ตั้งแต่วันที่ ๑ พฤศจิกายน พ.ศ. ๒๕๐๕\nสั่ง ณ วันที่ ๓ ตุลาคม ๒๕๒๕',
        name: 'a.pdf',
        engine_used: 'tesseract',
        quality: { passed: true, required_fields: 3, captured_fields: 3 },
      })
      .mockResolvedValueOnce({
        ok: true,
        markdown: 'ทั้งนี้ตั้งแต่วันที่ 1 พฤศจิกายน พ.ศ. ๒๕๖๘',
        name: 'a.pdf',
        engine_used: 'paddle',
        quality: { passed: true, required_fields: 3, captured_fields: 3 },
      });

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(14);

    expect(OcrHttpProvider.processSingleFile).toHaveBeenCalledTimes(2);
    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      14,
      expect.objectContaining({
        results: [
          expect.objectContaining({
            name: 'a.pdf',
            engine_used: 'paddle',
            markdown: 'ทั้งนี้ตั้งแต่วันที่ 1 พฤศจิกายน พ.ศ. ๒๕๖๘',
          }),
        ],
      }),
    );
  });

  test('uses paddle enhancement when tesseract markdown contains suspicious long order number', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('http://ocr.test');
    (OcrHttpProvider.getPaddleServiceBase as jest.Mock).mockReturnValue('http://paddle.test');
    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([
      { file_type: 'OTHER', file_path: 'uploads/a.pdf', file_name: 'a.pdf' },
    ]);
    (OcrHttpProvider.processSingleFile as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        markdown: 'คำสั่งกลุ่มงานเภสัชกรรม\nที่ ๑/ ๒๕๒๐๕',
        name: 'a.pdf',
        engine_used: 'tesseract',
        quality: { passed: true, required_fields: 3, captured_fields: 3 },
      })
      .mockResolvedValueOnce({
        ok: true,
        markdown: 'คำสั่งกลุ่มงานเภสัชกรรม\nที่ 1/568',
        name: 'a.pdf',
        engine_used: 'paddle',
        quality: { passed: true, required_fields: 3, captured_fields: 3 },
      });

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(15);

    expect(OcrHttpProvider.processSingleFile).toHaveBeenCalledTimes(2);
    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      15,
      expect.objectContaining({
        results: [
          expect.objectContaining({
            name: 'a.pdf',
            engine_used: 'paddle',
            markdown: 'คำสั่งกลุ่มงานเภสัชกรรม\nที่ 1/568',
          }),
        ],
      }),
    );
  });

  test('keeps tesseract result for non-assignment documents even when year looks old', async () => {
    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const { OcrRequestRepository } = await import('@/modules/ocr/repositories/ocr-request.repository.js');
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('http://ocr.test');
    (OcrHttpProvider.getPaddleServiceBase as jest.Mock).mockReturnValue('http://paddle.test');
    (OcrRequestRepository.findAttachments as jest.Mock).mockResolvedValue([
      { file_type: 'OTHER', file_path: 'uploads/a.pdf', file_name: 'a.pdf' },
    ]);
    (OcrHttpProvider.processSingleFile as jest.Mock).mockResolvedValueOnce({
      ok: true,
      markdown: 'บันทึกข้อความ\nวันที่ ๑ มกราคม พ.ศ. ๒๕๐๕',
      name: 'a.pdf',
      engine_used: 'tesseract',
      quality: { passed: true, required_fields: 3, captured_fields: 3 },
    });

    const { processRequestOcrPrecheck } = await import('@/modules/ocr/services/ocr-precheck.service.js');
    await processRequestOcrPrecheck(16);

    expect(OcrHttpProvider.processSingleFile).toHaveBeenCalledTimes(1);
    expect(OcrRequestRepository.updateRequestPrecheck).toHaveBeenLastCalledWith(
      16,
      expect.objectContaining({
        results: [
          expect.objectContaining({
            name: 'a.pdf',
            engine_used: 'tesseract',
          }),
        ],
      }),
    );
  });
});

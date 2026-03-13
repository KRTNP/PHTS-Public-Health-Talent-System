import { setupOcrHttpProviderEnv } from './ocr-http.provider.test-helpers.js';

describe('OcrHttpProvider (fallback chain)', () => {
  setupOcrHttpProviderEnv();

  test('falls back to local Paddle when local Tesseract quality does not pass', async () => {
    process.env.OCR_TYPHOON_SERVICE_URL = '';
    const localTesseractService = await import('@/modules/ocr/services/ocr-local-tesseract.service.js');
    const localPaddleService = await import('@/modules/ocr/services/ocr-local-paddle.service.js');

    jest.spyOn(localTesseractService, 'runLocalTesseract').mockResolvedValue({
      ok: true,
      name: 'order.pdf',
      markdown: 'low quality tesseract',
      engine_used: 'tesseract',
      quality: { required_fields: 4, captured_fields: 1, passed: false },
    });
    jest.spyOn(localPaddleService, 'runLocalPaddle').mockResolvedValue({
      ok: true,
      name: 'order.pdf',
      markdown: 'high quality paddle',
      engine_used: 'paddle',
      quality: { required_fields: 4, captured_fields: 4, passed: true },
    });

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'order.pdf',
      Buffer.from('file'),
      '',
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        engine_used: 'paddle',
        fallback_used: true,
      }),
    );
  });

  test('uses Typhoon as third step when local Tesseract and local Paddle quality are still not enough', async () => {
    process.env.OCR_TYPHOON_SERVICE_URL = 'http://typhoon.test';
    const localTesseractService = await import('@/modules/ocr/services/ocr-local-tesseract.service.js');
    const localPaddleService = await import('@/modules/ocr/services/ocr-local-paddle.service.js');

    jest.spyOn(localTesseractService, 'runLocalTesseract').mockResolvedValue({
      ok: true,
      name: 'order.pdf',
      markdown: 'low quality tesseract',
      engine_used: 'tesseract',
      quality: { required_fields: 4, captured_fields: 1, passed: false },
    });
    jest.spyOn(localPaddleService, 'runLocalPaddle').mockResolvedValue({
      ok: true,
      name: 'order.pdf',
      markdown: 'low quality paddle',
      engine_used: 'paddle',
      quality: { required_fields: 4, captured_fields: 2, passed: false },
    });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            ok: true,
            name: 'order.pdf',
            markdown: 'typhoon final quality',
            engine_used: 'typhoon',
            quality: {
              required_fields: 4,
              captured_fields: 4,
              passed: true,
            },
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'order.pdf',
      Buffer.from('file'),
      '',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://typhoon.test/ocr-batch');
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        engine_used: 'typhoon',
        fallback_used: true,
      }),
    );
  });

  test('returns local Paddle result when Typhoon is unavailable', async () => {
    process.env.OCR_TYPHOON_SERVICE_URL = 'http://typhoon.test';
    const localTesseractService = await import('@/modules/ocr/services/ocr-local-tesseract.service.js');
    const localPaddleService = await import('@/modules/ocr/services/ocr-local-paddle.service.js');

    jest.spyOn(localTesseractService, 'runLocalTesseract').mockResolvedValue({
      ok: true,
      name: 'order.pdf',
      markdown: 'low quality tesseract',
      engine_used: 'tesseract',
      quality: { required_fields: 4, captured_fields: 1, passed: false },
    });
    jest.spyOn(localPaddleService, 'runLocalPaddle').mockResolvedValue({
      ok: true,
      name: 'order.pdf',
      markdown: 'low quality paddle',
      engine_used: 'paddle',
      quality: { required_fields: 4, captured_fields: 2, passed: false },
    });

    const fetchMock = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED typhoon'));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'order.pdf',
      Buffer.from('file'),
      '',
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        engine_used: 'paddle',
        fallback_used: true,
      }),
    );
  });

  test('falls back to local Paddle when local Tesseract is unavailable', async () => {
    process.env.OCR_TYPHOON_SERVICE_URL = '';
    const localTesseractService = await import('@/modules/ocr/services/ocr-local-tesseract.service.js');
    const localPaddleService = await import('@/modules/ocr/services/ocr-local-paddle.service.js');

    jest
      .spyOn(localTesseractService, 'runLocalTesseract')
      .mockRejectedValue(new Error('OCR_MAIN_SERVICE_UNAVAILABLE'));
    jest.spyOn(localPaddleService, 'runLocalPaddle').mockResolvedValue({
      ok: true,
      name: 'memo.pdf',
      markdown: 'paddle recovered',
      engine_used: 'paddle',
      quality: { required_fields: 3, captured_fields: 3, passed: true },
    });

    const { OcrHttpProvider } = await import('@/modules/ocr/providers/ocr-http.provider.js');
    const result = await OcrHttpProvider.processSingleFile(
      'memo.pdf',
      Buffer.from('file'),
      '',
    );

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        engine_used: 'paddle',
        fallback_used: true,
      }),
    );
  });
});

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

jest.mock('@/modules/ocr/providers/ocr-http.provider.js', () => ({
  OcrHttpProvider: {
    getServiceBase: jest.fn(),
    processSingleFile: jest.fn(),
  },
}));

import { readFile } from 'node:fs/promises';
import { OcrHttpProvider } from '@/modules/ocr/providers/ocr-http.provider.js';

describe('ocr batch runner service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs OCR for stored files and returns summarized counts', async () => {
    (readFile as jest.Mock).mockResolvedValue(Buffer.from('file'));
    (OcrHttpProvider.getServiceBase as jest.Mock).mockReturnValue('local-tesseract');
    (OcrHttpProvider.processSingleFile as jest.Mock)
      .mockResolvedValueOnce({ name: 'a.pdf', ok: true, markdown: 'a' })
      .mockResolvedValueOnce({ name: 'b.pdf', ok: false, error: 'bad' });

    const { runStoredFileOcrBatch } = await import(
      '@/modules/ocr/services/ocr-batch-runner.service.js'
    );

    const result = await runStoredFileOcrBatch([
      { file_name: 'a.pdf', file_path: 'uploads/a.pdf' },
      { file_name: 'b.pdf', file_path: 'uploads/b.pdf' },
    ]);

    expect(result).toEqual({
      service_url: 'local-tesseract',
      count: 2,
      success_count: 1,
      failed_count: 1,
      results: [
        { name: 'a.pdf', ok: true, markdown: 'a' },
        { name: 'b.pdf', ok: false, error: 'bad' },
      ],
    });

    expect(OcrHttpProvider.processSingleFile).toHaveBeenNthCalledWith(
      1,
      'a.pdf',
      expect.any(Buffer),
      'local-tesseract',
      undefined,
    );
  });

  it('merges OCR results by normalized file name and keeps existing when incoming is not clearly better', async () => {
    const { mergeOcrResultsByFileName } = await import(
      '@/modules/ocr/services/ocr-batch-runner.service.js'
    );

    const result = mergeOcrResultsByFileName(
      [
        { name: ' Memo.PDF ', ok: true, markdown: 'old primary markdown with enough text' },
        { name: 'order.pdf', ok: true, markdown: 'stay' },
      ],
      [
        { name: 'memo.pdf', ok: true, markdown: 'short incoming' },
        { name: 'fresh.pdf', ok: true, markdown: 'fresh' },
      ],
    );

    expect(result).toEqual([
      { name: ' Memo.PDF ', ok: true, markdown: 'old primary markdown with enough text' },
      { name: 'order.pdf', ok: true, markdown: 'stay' },
      { name: 'fresh.pdf', ok: true, markdown: 'fresh' },
    ]);
  });

  it('replaces existing OCR result when incoming quality passes and existing does not', async () => {
    const { mergeOcrResultsByFileName } = await import(
      '@/modules/ocr/services/ocr-batch-runner.service.js'
    );

    const result = mergeOcrResultsByFileName(
      [
        {
          name: 'memo.pdf',
          ok: true,
          markdown: 'old',
          quality: { passed: false },
          engine_used: 'tesseract',
        },
      ],
      [
        {
          name: 'memo.pdf',
          ok: true,
          markdown: 'new better',
          quality: { passed: true },
          engine_used: 'paddle',
        },
      ],
    );

    expect(result).toEqual([
      {
        name: 'memo.pdf',
        ok: true,
        markdown: 'new better',
        quality: { passed: true },
        engine_used: 'paddle',
      },
    ]);
  });

  it('replaces existing OCR result when existing has suspicious old Thai year and incoming does not', async () => {
    const { mergeOcrResultsByFileName } = await import(
      '@/modules/ocr/services/ocr-batch-runner.service.js'
    );

    const result = mergeOcrResultsByFileName(
      [
        {
          name: 'order.pdf',
          ok: true,
          markdown: 'ทั้งนี้ตั้งแต่วันที่ ๑ พฤศจิกายน พ.ศ. ๒๕๐๕',
          engine_used: 'tesseract',
        },
      ],
      [
        {
          name: 'order.pdf',
          ok: true,
          markdown: 'ทั้งนี้ตั้งแต่วันที่ 1 พฤศจิกายน พ.ศ. ๒๕๖๘',
          engine_used: 'paddle',
        },
      ],
    );

    expect(result).toEqual([
      {
        name: 'order.pdf',
        ok: true,
        markdown: 'ทั้งนี้ตั้งแต่วันที่ 1 พฤศจิกายน พ.ศ. ๒๕๖๘',
        engine_used: 'paddle',
      },
    ]);
  });

  it('replaces existing OCR result when existing has suspicious long order no suffix', async () => {
    const { mergeOcrResultsByFileName } = await import(
      '@/modules/ocr/services/ocr-batch-runner.service.js'
    );

    const result = mergeOcrResultsByFileName(
      [
        {
          name: 'order.pdf',
          ok: true,
          markdown: 'คำสั่งกลุ่มงานเภสัชกรรม\nที่ ๑/ ๒๕๒๐๕',
          engine_used: 'tesseract',
        },
      ],
      [
        {
          name: 'order.pdf',
          ok: true,
          markdown: 'คำสั่งกลุ่มงานเภสัชกรรม\nที่ 1/568',
          engine_used: 'paddle',
        },
      ],
    );

    expect(result).toEqual([
      {
        name: 'order.pdf',
        ok: true,
        markdown: 'คำสั่งกลุ่มงานเภสัชกรรม\nที่ 1/568',
        engine_used: 'paddle',
      },
    ]);
  });
});

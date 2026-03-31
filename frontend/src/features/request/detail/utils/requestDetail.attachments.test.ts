import { afterEach, describe, expect, it } from 'vitest';
import { buildAttachmentUrl } from '@/features/request/detail/utils/requestDetail.attachments';

const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL;

describe('buildAttachmentUrl', () => {
  afterEach(() => {
    if (ORIGINAL_API_URL === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL;
    }
  });

  it('uses same-origin uploads path by default', () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    expect(buildAttachmentUrl('uploads/test/a.pdf')).toBe('/uploads/test/a.pdf');
    expect(buildAttachmentUrl('/uploads/test/a.pdf')).toBe('/uploads/test/a.pdf');
  });

  it('keeps absolute URL input unchanged', () => {
    const absolute = 'https://cdn.example.com/uploads/test/a.pdf';
    expect(buildAttachmentUrl(absolute)).toBe(absolute);
  });

  it('uses explicit API base override as exceptional path', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/api';
    expect(buildAttachmentUrl('uploads/test/a.pdf')).toBe('https://api.example.com/uploads/test/a.pdf');
  });
});

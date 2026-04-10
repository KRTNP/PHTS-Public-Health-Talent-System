import { afterEach, describe, expect, it } from 'vitest';
import { buildAttachmentUrl } from '@/features/request/detail/utils/requestDetail.attachments';

const ORIGINAL_API_URL = process.env.NEXT_PUBLIC_API_URL;
const ORIGINAL_ALLOW_DIRECT = process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN;

describe('buildAttachmentUrl', () => {
  afterEach(() => {
    if (ORIGINAL_API_URL === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = ORIGINAL_API_URL;
    }

    if (ORIGINAL_ALLOW_DIRECT === undefined) {
      delete process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN;
    } else {
      process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN = ORIGINAL_ALLOW_DIRECT;
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

  it('ignores direct API origin from env by default to keep same-origin transport', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/api';
    delete process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN;
    expect(buildAttachmentUrl('uploads/test/a.pdf')).toBe('/uploads/test/a.pdf');
  });

  it('allows direct API origin from env only when explicitly opted in', () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com/api';
    process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN = 'true';
    expect(buildAttachmentUrl('uploads/test/a.pdf')).toBe('https://api.example.com/uploads/test/a.pdf');
  });
});

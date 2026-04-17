import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_BROWSER_API_BASE,
  DEFAULT_BROWSER_UPLOADS_BASE,
  resolveApiBaseUrl,
  resolveUploadsBaseUrl,
} from '@/shared/api/base-url';

const ORIGINAL_ALLOW_DIRECT = process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN;

describe('base-url transport strategy', () => {
  afterEach(() => {
    if (ORIGINAL_ALLOW_DIRECT === undefined) {
      delete process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN;
    } else {
      process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN = ORIGINAL_ALLOW_DIRECT;
    }
  });

  it('defaults api base to same-origin /api', () => {
    expect(resolveApiBaseUrl()).toBe(DEFAULT_BROWSER_API_BASE);
    expect(resolveApiBaseUrl('')).toBe(DEFAULT_BROWSER_API_BASE);
  });

  it('forces same-origin for absolute api base in browser by default', () => {
    delete process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN;
    expect(resolveApiBaseUrl('https://api.example.com/api')).toBe(DEFAULT_BROWSER_API_BASE);
  });

  it('allows explicit absolute backend override only when opt-in flag is enabled', () => {
    process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN = 'true';
    expect(resolveApiBaseUrl('https://api.example.com/api')).toBe('https://api.example.com/api');
  });

  it('keeps relative override paths without forcing absolute origin', () => {
    expect(resolveApiBaseUrl('/api')).toBe('/api');
    expect(resolveApiBaseUrl('/internal/api/')).toBe('/internal/api');
  });

  it('resolves uploads base to same-origin /uploads by default', () => {
    expect(resolveUploadsBaseUrl()).toBe(DEFAULT_BROWSER_UPLOADS_BASE);
  });

  it('maps explicit api base override to same-origin uploads root by default', () => {
    delete process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN;
    expect(resolveUploadsBaseUrl('https://api.example.com/api')).toBe(DEFAULT_BROWSER_UPLOADS_BASE);
  });

  it('maps explicit api base override to remote uploads root when opt-in flag is enabled', () => {
    process.env.NEXT_PUBLIC_ALLOW_DIRECT_API_ORIGIN = 'true';
    expect(resolveUploadsBaseUrl('https://api.example.com/api')).toBe('https://api.example.com/uploads');
  });
});

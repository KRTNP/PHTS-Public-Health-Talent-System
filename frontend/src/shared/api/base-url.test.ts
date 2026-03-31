import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BROWSER_API_BASE,
  DEFAULT_BROWSER_UPLOADS_BASE,
  resolveApiBaseUrl,
  resolveUploadsBaseUrl,
} from '@/shared/api/base-url';

describe('base-url transport strategy', () => {
  it('defaults api base to same-origin /api', () => {
    expect(resolveApiBaseUrl()).toBe(DEFAULT_BROWSER_API_BASE);
    expect(resolveApiBaseUrl('')).toBe(DEFAULT_BROWSER_API_BASE);
  });

  it('keeps explicit absolute backend override when provided', () => {
    expect(resolveApiBaseUrl('https://api.example.com/api')).toBe('https://api.example.com/api');
  });

  it('keeps relative override paths without forcing absolute origin', () => {
    expect(resolveApiBaseUrl('/api')).toBe('/api');
    expect(resolveApiBaseUrl('/internal/api/')).toBe('/internal/api');
  });

  it('resolves uploads base to same-origin /uploads by default', () => {
    expect(resolveUploadsBaseUrl()).toBe(DEFAULT_BROWSER_UPLOADS_BASE);
  });

  it('maps explicit api base override to uploads root', () => {
    expect(resolveUploadsBaseUrl('https://api.example.com/api')).toBe('https://api.example.com/uploads');
  });
});

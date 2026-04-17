import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuthSession,
  hasAuthSessionHint,
  persistAuthSession,
  setStoredAuthUser,
} from '@/shared/auth/session';
import {
  AUTH_SESSION_HINT_STORAGE_NAME,
  AUTH_TOKEN_STORAGE_NAME,
  AUTH_USER_STORAGE_NAME,
} from '@/shared/auth/storage';

describe('auth session utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persists session hint/user without storing auth token in browser storage', () => {
    const user = { id: 1, role: 'HEAD_HR' };

    persistAuthSession('token-123', user);

    expect(hasAuthSessionHint()).toBe(true);
    expect(sessionStorage.getItem(AUTH_SESSION_HINT_STORAGE_NAME)).toBe('1');
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_NAME)).toBeNull();
    expect(sessionStorage.getItem(AUTH_USER_STORAGE_NAME)).toBe(JSON.stringify(user));
  });

  it('can update stored user payload in session storage', () => {
    persistAuthSession('token-x', { id: 1 });
    setStoredAuthUser({ id: 2, role: 'HEAD_FINANCE' });

    expect(sessionStorage.getItem(AUTH_USER_STORAGE_NAME)).toBe(
      JSON.stringify({ id: 2, role: 'HEAD_FINANCE' }),
    );
  });

  it('clears session hint/user and legacy local storage token', () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_NAME, 'legacy-token');
    persistAuthSession('token-y', { id: 99 });
    clearAuthSession();

    expect(hasAuthSessionHint()).toBe(false);
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_NAME)).toBeNull();
    expect(sessionStorage.getItem(AUTH_USER_STORAGE_NAME)).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAuthSession,
  persistAuthSession,
  readAuthSessionToken,
  setStoredAuthUser,
  syncAuthTokenCookie,
} from '@/shared/auth/session';
import {
  AUTH_TOKEN_COOKIE_NAME,
  AUTH_TOKEN_STORAGE_NAME,
  AUTH_USER_STORAGE_NAME,
} from '@/shared/auth/storage';

describe('auth session utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  });

  it('persists and reads auth session token/user', () => {
    const token = 'token-123';
    const user = { id: 1, role: 'HEAD_HR' };

    persistAuthSession(token, user);

    expect(readAuthSessionToken()).toBe(token);
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_NAME)).toBe(token);
    expect(localStorage.getItem(AUTH_USER_STORAGE_NAME)).toBe(JSON.stringify(user));
    expect(document.cookie).toContain(`${AUTH_TOKEN_COOKIE_NAME}=token-123`);
  });

  it('can update stored user without overwriting token', () => {
    persistAuthSession('token-x', { id: 1 });
    setStoredAuthUser({ id: 2, role: 'HEAD_FINANCE' });

    expect(readAuthSessionToken()).toBe('token-x');
    expect(localStorage.getItem(AUTH_USER_STORAGE_NAME)).toBe(
      JSON.stringify({ id: 2, role: 'HEAD_FINANCE' }),
    );
  });

  it('clears auth session token/user and cookie', () => {
    persistAuthSession('token-y', { id: 99 });
    clearAuthSession();

    expect(readAuthSessionToken()).toBeNull();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_NAME)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_STORAGE_NAME)).toBeNull();
  });

  it('syncs cookie from existing token value', () => {
    syncAuthTokenCookie('abc-999');
    expect(document.cookie).toContain(`${AUTH_TOKEN_COOKIE_NAME}=abc-999`);
  });
});

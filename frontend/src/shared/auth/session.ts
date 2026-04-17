import {
  AUTH_SESSION_HINT_STORAGE_NAME,
  AUTH_TOKEN_STORAGE_NAME,
  AUTH_USER_STORAGE_NAME,
} from '@/shared/auth/storage';

const isBrowser = (): boolean => typeof window !== 'undefined';

export const readAuthSessionToken = (): string | null => {
  return null;
};

export const hasAuthSessionHint = (): boolean => {
  if (!isBrowser()) return false;
  return sessionStorage.getItem(AUTH_SESSION_HINT_STORAGE_NAME) === '1';
};

export const setStoredAuthUser = (user: unknown) => {
  if (!isBrowser()) return;
  sessionStorage.setItem(AUTH_USER_STORAGE_NAME, JSON.stringify(user));
};

export const persistAuthSession = (token: string, user: unknown) => {
  if (!isBrowser()) return;
  void token; // preserved for backward-compatible function signature
  sessionStorage.setItem(AUTH_SESSION_HINT_STORAGE_NAME, '1');
  sessionStorage.setItem(AUTH_USER_STORAGE_NAME, JSON.stringify(user));
};

export const clearAuthSession = () => {
  if (!isBrowser()) return;
  sessionStorage.removeItem(AUTH_SESSION_HINT_STORAGE_NAME);
  sessionStorage.removeItem(AUTH_USER_STORAGE_NAME);
  // Cleanup legacy browser-stored token/user from previous versions.
  localStorage.removeItem(AUTH_TOKEN_STORAGE_NAME);
  localStorage.removeItem(AUTH_USER_STORAGE_NAME);
};

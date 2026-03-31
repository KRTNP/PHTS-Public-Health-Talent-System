import {
  AUTH_TOKEN_COOKIE_NAME,
  AUTH_TOKEN_STORAGE_NAME,
  AUTH_USER_STORAGE_NAME,
} from '@/shared/auth/storage';

const isBrowser = (): boolean => typeof window !== 'undefined';

const setTokenCookie = (token: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Secure`;
};

const clearTokenCookie = () => {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
};

export const readAuthSessionToken = (): string | null => {
  if (!isBrowser()) return null;
  return localStorage.getItem(AUTH_TOKEN_STORAGE_NAME);
};

export const syncAuthTokenCookie = (token: string) => {
  setTokenCookie(token);
};

export const setStoredAuthUser = (user: unknown) => {
  if (!isBrowser()) return;
  localStorage.setItem(AUTH_USER_STORAGE_NAME, JSON.stringify(user));
};

export const persistAuthSession = (token: string, user: unknown) => {
  if (!isBrowser()) return;
  localStorage.setItem(AUTH_TOKEN_STORAGE_NAME, token);
  localStorage.setItem(AUTH_USER_STORAGE_NAME, JSON.stringify(user));
  setTokenCookie(token);
};

export const clearAuthSession = () => {
  if (!isBrowser()) return;
  localStorage.removeItem(AUTH_TOKEN_STORAGE_NAME);
  localStorage.removeItem(AUTH_USER_STORAGE_NAME);
  clearTokenCookie();
};

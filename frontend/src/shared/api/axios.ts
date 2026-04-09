import axios, { AxiosError } from 'axios';
import { resolveApiBaseUrl } from '@/shared/api/base-url';
import {
  clearAuthSession,
  readAuthSessionToken,
} from '@/shared/auth/session';
import { redirectToLogin } from '@/shared/auth/redirect-policy';

const api = axios.create({
  baseURL: resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL),
  headers: {
    'Content-Type': 'application/json',
  },
});

type ValidationDetail = {
  field?: string;
  message?: string;
};

type ApiErrorBody = {
  success?: boolean;
  error?: unknown;
  message?: string;
  details?: ValidationDetail[];
};

const isLoginRequest = (url: unknown): boolean => {
  if (typeof url !== "string") return false;
  return /(^|\/)auth\/login($|\?)/.test(url);
};

const toReadableErrorMessage = (body?: ApiErrorBody): string => {
  if (!body) return 'เกิดข้อผิดพลาดจากการเชื่อมต่อระบบ';

  if (Array.isArray(body.details) && body.details.length > 0) {
    const first = body.details[0];
    if (first?.message) return first.message;
  }

  if (typeof body.error === 'string' && body.error.trim().length > 0) {
    return body.error;
  }
  if (body.error && typeof body.error === 'object') {
    const nestedMessage = (body.error as { message?: unknown }).message;
    if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
      return nestedMessage;
    }
  }

  return body.message || 'เกิดข้อผิดพลาดจากการเชื่อมต่อระบบ';
};

// Interceptor: Attach Token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = readAuthSessionToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor: Handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const axiosError = axios.isAxiosError<ApiErrorBody>(error)
      ? (error as AxiosError<ApiErrorBody>)
      : null;
    const errorBody = axiosError?.response?.data;
    const readableMessage = toReadableErrorMessage(errorBody);

    if (
      axiosError?.response?.status === 401 &&
      !isLoginRequest(axiosError.config?.url)
    ) {
      clearAuthSession();
      redirectToLogin();
    }

    if (axiosError) {
      axiosError.message = readableMessage;
      (axiosError as AxiosError<ApiErrorBody> & { details?: ValidationDetail[] }).details =
        errorBody?.details;
      return Promise.reject(axiosError);
    }

    return Promise.reject(error);
  }
);

export default api;

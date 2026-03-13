export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export type ApiParams = Record<string, string | number | boolean | undefined>;
export type ApiPayload = Record<string, unknown>;
export type ApiList = Record<string, unknown>[];

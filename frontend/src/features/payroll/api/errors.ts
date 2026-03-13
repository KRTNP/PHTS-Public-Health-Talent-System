import { isAxiosError } from "axios";

type ApiErrorPayload = {
  error?: string;
  data?: {
    code?: string;
  };
};

export function getApiErrorCode(error: unknown): string | undefined {
  if (!isAxiosError<ApiErrorPayload>(error)) return undefined;
  return error.response?.data?.data?.code;
}

export function isSnapshotNotReadyError(error: unknown): boolean {
  const code = getApiErrorCode(error);
  if (code === "SNAPSHOT_NOT_READY") return true;

  if (!isAxiosError<ApiErrorPayload>(error)) return false;
  const message = String(error.response?.data?.error ?? "").toUpperCase();
  return message.includes("SNAPSHOT_NOT_READY");
}

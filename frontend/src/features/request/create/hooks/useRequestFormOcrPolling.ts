import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { RequestFormData, RequestWithDetails } from "@/types/request.types";

type UseRequestFormOcrPollingOptions = {
  draftRequestId: number | null;
  ocrStatus: string;
  pollIntervalMs: number;
  latestSubmittingRef: MutableRefObject<boolean>;
  setFormDataField: (key: keyof RequestFormData, value: unknown) => void;
  setOcrPrecheck: (value: RequestWithDetails["ocr_precheck"]) => void;
  fetchRequestById: (requestId: number) => Promise<RequestWithDetails>;
};

export function useRequestFormOcrPolling(options: UseRequestFormOcrPollingOptions) {
  const ocrPollInFlightRef = useRef(false);
  const {
    draftRequestId,
    ocrStatus,
    pollIntervalMs,
    latestSubmittingRef,
    setFormDataField,
    setOcrPrecheck,
    fetchRequestById,
  } = options;

  useEffect(() => {
    if (!draftRequestId || !["queued", "processing"].includes(ocrStatus)) {
      return;
    }
    const requestId = draftRequestId;

    let cancelled = false;

    const refreshDraftOcr = async () => {
      if (cancelled || latestSubmittingRef.current || ocrPollInFlightRef.current) {
        return;
      }
      ocrPollInFlightRef.current = true;
      try {
        const latestRequest = await fetchRequestById(requestId);
        if (cancelled) return;
        setFormDataField("attachments", latestRequest.attachments ?? []);
        setOcrPrecheck(latestRequest.ocr_precheck ?? null);
      } catch (error) {
        if (!cancelled) {
          console.error("[OcrPoll] failed:", error);
        }
      } finally {
        ocrPollInFlightRef.current = false;
      }
    };

    void refreshDraftOcr();
    const interval = setInterval(() => {
      void refreshDraftOcr();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    draftRequestId,
    fetchRequestById,
    latestSubmittingRef,
    ocrStatus,
    pollIntervalMs,
    setFormDataField,
    setOcrPrecheck,
  ]);
}

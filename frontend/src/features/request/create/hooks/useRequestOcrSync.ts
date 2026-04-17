"use client";

import { useEffect } from "react";
import type { MutableRefObject } from "react";
import { getRequestById } from "@/features/request/core/api";
import type { RequestFormData, RequestWithDetails } from "@/types/request.types";
import { extractEffectiveDateFromOcrPrecheck } from "./useRequestFormPrefillUtils";
import { useRequestFormOcrPolling } from "./useRequestFormOcrPolling";

const OCR_POLL_INTERVAL_MS = 2500;

type UseRequestOcrSyncOptions = {
  formData: RequestFormData;
  touchedKeysRef: MutableRefObject<Set<keyof RequestFormData>>;
  draftRequestId: number | null;
  ocrPrecheck: RequestWithDetails["ocr_precheck"];
  latestSubmittingRef: MutableRefObject<boolean>;
  setFormDataField: (key: keyof RequestFormData, value: unknown) => void;
  setOcrPrecheck: (value: RequestWithDetails["ocr_precheck"]) => void;
};

export function useRequestOcrSync(options: UseRequestOcrSyncOptions) {
  const {
    draftRequestId,
    formData,
    latestSubmittingRef,
    ocrPrecheck,
    setFormDataField,
    setOcrPrecheck,
    touchedKeysRef,
  } = options;

  useEffect(() => {
    if (touchedKeysRef.current.has("effectiveDate")) return;
    const personName = `${formData.firstName ?? ""} ${formData.lastName ?? ""}`.trim();
    const ocrEffectiveDate = extractEffectiveDateFromOcrPrecheck(ocrPrecheck, personName);
    if (!ocrEffectiveDate) return;
    if (formData.effectiveDate === ocrEffectiveDate) return;
    setFormDataField("effectiveDate", ocrEffectiveDate);
  }, [
    formData.effectiveDate,
    formData.firstName,
    formData.lastName,
    ocrPrecheck,
    setFormDataField,
    touchedKeysRef,
  ]);

  useRequestFormOcrPolling({
    draftRequestId,
    ocrStatus: String(ocrPrecheck?.status ?? "").toLowerCase(),
    pollIntervalMs: OCR_POLL_INTERVAL_MS,
    latestSubmittingRef,
    setFormDataField,
    setOcrPrecheck,
    fetchRequestById: getRequestById,
  });
}

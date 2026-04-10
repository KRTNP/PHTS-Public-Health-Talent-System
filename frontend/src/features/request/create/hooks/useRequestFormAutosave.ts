import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { RequestFormData, RequestWithDetails } from "@/types/request.types";

export type DraftAutosaveStatus = "idle" | "saving" | "saved" | "error";

type DraftAutosaveResponse = {
  request_id: number;
  attachments?: RequestWithDetails["attachments"];
  ocr_precheck?: RequestWithDetails["ocr_precheck"];
};

type UseDraftAutosaveOptions = {
  delayMs: number;
  initiallyEnabled: boolean;
  isOfficerOnBehalfFlow: boolean;
  latestSubmittingRef: MutableRefObject<boolean>;
  latestFormDataRef: MutableRefObject<RequestFormData>;
  latestDraftRequestIdRef: MutableRefObject<number | null>;
  buildFormData: (source: RequestFormData, includeSignature: boolean) => FormData;
  persistDraftRequest: (
    existingDraftId: number | null,
    formData: FormData,
  ) => Promise<DraftAutosaveResponse>;
  onDraftPersisted: (response: DraftAutosaveResponse, existingDraftId: number | null) => void;
};

export function useRequestFormAutosave(options: UseDraftAutosaveOptions) {
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef(false);
  const autosaveRequeueRef = useRef(false);
  const autosaveEnabledRef = useRef(options.initiallyEnabled);
  const [autosaveStatus, setAutosaveStatus] = useState<DraftAutosaveStatus>("idle");
  const [autosaveLastSavedAt, setAutosaveLastSavedAt] = useState<string | null>(null);

  const persistDraftSnapshot = useCallback(async (): Promise<void> => {
    if (!autosaveEnabledRef.current) return;
    if (options.latestSubmittingRef.current) return;
    if (options.isOfficerOnBehalfFlow && !options.latestDraftRequestIdRef.current) return;

    if (autosaveInFlightRef.current) {
      autosaveRequeueRef.current = true;
      return;
    }

    autosaveInFlightRef.current = true;
    setAutosaveStatus("saving");
    try {
      const form = options.buildFormData(options.latestFormDataRef.current, false);
      const existingDraftId = options.latestDraftRequestIdRef.current;
      const response = await options.persistDraftRequest(existingDraftId, form);
      options.onDraftPersisted(response, existingDraftId);
      setAutosaveLastSavedAt(new Date().toISOString());
      setAutosaveStatus("saved");
    } catch (error) {
      console.error("[DraftAutosave] failed:", error);
      setAutosaveStatus("error");
    } finally {
      autosaveInFlightRef.current = false;
      if (autosaveRequeueRef.current) {
        autosaveRequeueRef.current = false;
        void persistDraftSnapshot();
      }
    }
  }, [options]);

  const clearAutosaveTimer = useCallback(() => {
    if (!autosaveTimerRef.current) return;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = null;
  }, []);

  const scheduleAutosave = useCallback(() => {
    clearAutosaveTimer();
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistDraftSnapshot();
    }, options.delayMs);
  }, [clearAutosaveTimer, options.delayMs, persistDraftSnapshot]);

  const setAutosaveEnabled = useCallback(
    (enabled: boolean) => {
      autosaveEnabledRef.current = enabled;
      if (!enabled) {
        clearAutosaveTimer();
        setAutosaveStatus("idle");
        setAutosaveLastSavedAt(null);
      }
    },
    [clearAutosaveTimer],
  );

  useEffect(() => {
    return () => {
      clearAutosaveTimer();
    };
  }, [clearAutosaveTimer]);

  return {
    autosaveStatus,
    autosaveLastSavedAt,
    autosaveEnabledRef,
    setAutosaveEnabled,
    scheduleAutosave,
    clearAutosaveTimer,
    persistDraftSnapshot,
  };
}

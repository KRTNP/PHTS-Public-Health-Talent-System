"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RequestFormData, RequestWithDetails } from "@/types/request.types";
import { useAuth } from "@/components/providers/auth-provider";
import {
  INITIAL_FORM_DATA,
  useRequestDraftPersistence,
} from "./useRequestDraftPersistence";
import { useRequestAttachmentActions } from "./useRequestAttachmentActions";
import { useRequestOcrSync } from "./useRequestOcrSync";
import { useRequestPrefillState } from "./useRequestPrefillState";
import { useRequestSubmitFlow } from "./useRequestSubmitFlow";

export function useRequestForm(options?: {
  initialRequest?: RequestWithDetails;
  returnPath?: string;
  prefillUserId?: number;
}) {
  const router = useRouter();
  const { user } = useAuth();

  const touchedKeysRef = useRef<Set<keyof RequestFormData>>(new Set());
  const [formData, setFormData] = useState<RequestFormData>(INITIAL_FORM_DATA);
  const [ocrPrecheck, setOcrPrecheck] = useState<RequestWithDetails["ocr_precheck"]>(
    options?.initialRequest?.ocr_precheck ?? null,
  );

  const isOfficerOnBehalfFlow = Boolean(
    options?.prefillUserId && user?.role === "PTS_OFFICER" && !options?.initialRequest,
  );

  const setFormDataField = useCallback((key: keyof RequestFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const {
    draftRequestId,
    setDraftRequestId,
    isSubmitting,
    setIsSubmitting,
    autosaveStatus,
    autosaveLastSavedAt,
    autosaveEnabledRef,
    setAutosaveEnabled,
    scheduleAutosave,
    clearAutosaveTimer,
    buildFormData,
    latestSubmittingRef,
  } = useRequestDraftPersistence({
    initialRequest: options?.initialRequest,
    prefillUserId: options?.prefillUserId,
    isOfficerOnBehalfFlow,
    formData,
    setFormDataField,
    setOcrPrecheck,
  });

  useRequestOcrSync({
    formData,
    touchedKeysRef,
    draftRequestId,
    ocrPrecheck,
    latestSubmittingRef,
    setFormDataField,
    setOcrPrecheck,
  });

  const { prefillOriginal } = useRequestPrefillState({
    initialRequest: options?.initialRequest,
    prefillUserId: options?.prefillUserId,
    user,
    formData,
    setFormData,
    setFormDataField,
    touchedKeysRef,
    setDraftRequestId,
    setOcrPrecheck,
    setAutosaveEnabled,
  });

  const { handleUploadFile, removeFile, removeExistingAttachment } =
    useRequestAttachmentActions({
      draftRequestId,
      setFormData,
      setFormDataField,
      setOcrPrecheck,
      autosaveEnabledRef,
      scheduleAutosave,
      setAutosaveEnabled,
      setIsSubmitting,
    });

  const { confirmAttachments, submitRequestFlow } = useRequestSubmitFlow({
    formData,
    draftRequestId,
    setDraftRequestId,
    setIsSubmitting,
    setFormDataField,
    setOcrPrecheck,
    clearAutosaveTimer,
    buildFormData,
    isOfficerOnBehalfFlow,
    prefillUserId: options?.prefillUserId,
    userRole: user?.role,
    returnPath: options?.returnPath ?? "/user/my-requests",
    navigate: router.push,
  });

  const updateFormData = (key: keyof RequestFormData, value: unknown) => {
    touchedKeysRef.current.add(key);
    setFormDataField(key, value);

    if (
      autosaveEnabledRef.current &&
      (key === "rateMapping" || key === "signatureMode" || key === "signature")
    ) {
      scheduleAutosave();
    }
  };

  return {
    formData,
    updateFormData,
    handleUploadFile,
    removeFile,
    removeExistingAttachment,
    isSubmitting,
    submitRequest: submitRequestFlow,
    confirmAttachments,
    prefillOriginal,
    autosaveStatus,
    autosaveLastSavedAt,
    ocrPrecheck,
  };
}

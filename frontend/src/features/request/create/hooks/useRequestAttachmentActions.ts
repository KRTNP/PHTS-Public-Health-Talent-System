"use client";

import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { toast } from "sonner";
import { deleteRequestAttachment } from "@/features/request/core/api";
import type { RequestFormData, RequestWithDetails } from "@/types/request.types";

type UseRequestAttachmentActionsOptions = {
  draftRequestId: number | null;
  setFormData: Dispatch<SetStateAction<RequestFormData>>;
  setFormDataField: (key: keyof RequestFormData, value: unknown) => void;
  setOcrPrecheck: (value: RequestWithDetails["ocr_precheck"]) => void;
  autosaveEnabledRef: MutableRefObject<boolean>;
  scheduleAutosave: () => void;
  setAutosaveEnabled: (enabled: boolean) => void;
  setIsSubmitting: (value: boolean) => void;
};

export function useRequestAttachmentActions(options: UseRequestAttachmentActionsOptions) {
  const handleUploadFile = useCallback(
    (file: File) => {
      options.setAutosaveEnabled(true);
      options.setFormData((prev) => ({
        ...prev,
        files: prev.files.some(
          (existing) =>
            existing.name === file.name &&
            existing.size === file.size &&
            existing.lastModified === file.lastModified,
        )
          ? prev.files
          : [...prev.files, file],
      }));
      options.scheduleAutosave();
    },
    [options],
  );

  const removeFile = useCallback(
    (index: number) => {
      options.setFormData((prev) => ({
        ...prev,
        files: prev.files.filter((_, i) => i !== index),
      }));
      if (options.autosaveEnabledRef.current) {
        options.scheduleAutosave();
      }
    },
    [options],
  );

  const removeExistingAttachment = useCallback(
    async (attachmentId: number) => {
      if (!options.draftRequestId) return;
      options.setIsSubmitting(true);
      try {
        const updated = await deleteRequestAttachment(options.draftRequestId, attachmentId);
        options.setFormDataField("attachments", updated.attachments ?? []);
        options.setOcrPrecheck(updated.ocr_precheck ?? null);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการลบไฟล์แนบ";
        toast.error(msg);
      } finally {
        options.setIsSubmitting(false);
      }
    },
    [options],
  );

  return {
    handleUploadFile,
    removeFile,
    removeExistingAttachment,
  };
}

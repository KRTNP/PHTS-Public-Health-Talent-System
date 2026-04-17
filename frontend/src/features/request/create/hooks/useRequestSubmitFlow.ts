"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  confirmAttachments as confirmAttachmentsApi,
  createRequest,
  submitRequest,
  updateRateMapping,
  updateRequest,
} from "@/features/request/core/api";
import type { RequestFormData, RequestWithDetails } from "@/types/request.types";
import type { BuildRequestFormData } from "./useRequestDraftPersistence";

const parseGroupItem = (groupId: string, itemId: string, subItemId?: string) => {
  const groupMatch = groupId.match(/\d+/);
  const group_no = groupMatch ? Number(groupMatch[0]) : null;

  if (!itemId || itemId === "__NONE__") {
    return { group_no, item_no: null, sub_item_no: null };
  }

  return {
    group_no,
    item_no: itemId,
    sub_item_no: subItemId || null,
  };
};

type UseRequestSubmitFlowOptions = {
  formData: RequestFormData;
  draftRequestId: number | null;
  setDraftRequestId: (value: number | null) => void;
  setIsSubmitting: (value: boolean) => void;
  setFormDataField: (key: keyof RequestFormData, value: unknown) => void;
  setOcrPrecheck: (value: RequestWithDetails["ocr_precheck"]) => void;
  clearAutosaveTimer: () => void;
  buildFormData: BuildRequestFormData;
  isOfficerOnBehalfFlow: boolean;
  prefillUserId?: number;
  userRole?: string;
  returnPath: string;
  navigate: (path: string) => void;
};

export function useRequestSubmitFlow(options: UseRequestSubmitFlowOptions) {
  const confirmAttachments = useCallback(async () => {
    options.setIsSubmitting(true);
    try {
      if (options.isOfficerOnBehalfFlow && !options.draftRequestId) {
        return true;
      }

      options.clearAutosaveTimer();

      const form = options.buildFormData(options.formData, false);
      const request = options.draftRequestId
        ? await updateRequest(options.draftRequestId, form)
        : await createRequest(form);

      if (!options.draftRequestId) options.setDraftRequestId(request.request_id);
      options.setFormDataField("id", String(request.request_id));
      options.setFormDataField("attachments", request.attachments ?? []);
      options.setOcrPrecheck(request.ocr_precheck ?? null);
      options.setFormDataField("files", []);

      const attachments = request.attachments ?? [];
      const license = attachments.find((att) => att.file_type === "LICENSE");
      if (license?.attachment_id) {
        await confirmAttachmentsApi(request.request_id);
      }

      return true;
    } finally {
      options.setIsSubmitting(false);
    }
  }, [options]);

  const submitRequestFlow = useCallback(async () => {
    options.setIsSubmitting(true);
    try {
      options.clearAutosaveTimer();

      const form = options.buildFormData(options.formData, true);
      const request = options.draftRequestId
        ? await updateRequest(options.draftRequestId, form)
        : await createRequest(form);

      options.setFormDataField("attachments", request.attachments ?? []);
      options.setOcrPrecheck(request.ocr_precheck ?? null);
      options.setFormDataField("files", []);

      const parsed = parseGroupItem(
        options.formData.rateMapping.groupId,
        options.formData.rateMapping.itemId,
        options.formData.rateMapping.subItemId,
      );
      if (parsed.group_no) {
        await updateRateMapping(request.request_id, {
          group_no: parsed.group_no,
          item_no: parsed.item_no || "",
          sub_item_no: parsed.sub_item_no,
        });
      }

      await submitRequest(request.request_id);
      toast.success("ยื่นคำขอเรียบร้อยแล้ว");

      const nextPath =
        options.prefillUserId && options.userRole === "PTS_OFFICER"
          ? `/pts-officer/requests/${request.request_id}`
          : options.returnPath;
      options.navigate(nextPath);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการส่งคำขอ";
      toast.error(msg);
    } finally {
      options.setIsSubmitting(false);
    }
  }, [options]);

  return {
    confirmAttachments,
    submitRequestFlow,
  };
}

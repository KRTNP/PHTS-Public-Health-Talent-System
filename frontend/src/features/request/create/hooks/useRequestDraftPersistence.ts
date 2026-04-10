"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { RequestFormData, RequestWithDetails } from "@/types/request.types";
import { createRequest, updateRequest } from "@/features/request/core/api";
import { useRequestFormAutosave } from "./useRequestFormAutosave";

const DRAFT_AUTOSAVE_DELAY_MS = 700;

export const INITIAL_FORM_DATA: RequestFormData = {
  requestType: "NEW",
  title: "",
  firstName: "",
  lastName: "",
  citizenId: "",
  employeeType: "CIVIL_SERVANT",
  positionName: "",
  positionNumber: "",
  department: "",
  subDepartment: "",
  employmentRegion: "REGIONAL",
  effectiveDate: "",
  missionGroup: "",
  workAttributes: {
    operation: true,
    planning: true,
    coordination: true,
    service: true,
  },
  rateMapping: {
    groupId: "",
    itemId: "",
    amount: 0,
  },
  files: [],
  signatureMode: undefined,
};

type UseRequestDraftPersistenceOptions = {
  initialRequest?: RequestWithDetails;
  prefillUserId?: number;
  isOfficerOnBehalfFlow: boolean;
  formData: RequestFormData;
  setFormDataField: (key: keyof RequestFormData, value: unknown) => void;
  setOcrPrecheck: (value: RequestWithDetails["ocr_precheck"]) => void;
};

export type BuildRequestFormData = (
  source: RequestFormData,
  includeSignature?: boolean,
) => FormData;

export function useRequestDraftPersistence(options: UseRequestDraftPersistenceOptions) {
  const [draftRequestId, setDraftRequestId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const latestFormDataRef = useRef<RequestFormData>(options.formData);
  const latestDraftRequestIdRef = useRef<number | null>(null);
  const latestSubmittingRef = useRef(false);

  const buildFormData: BuildRequestFormData = useCallback(
    (source, includeSignature = true) => {
      const fd = new FormData();

      const typeMap: Record<string, string> = {
        NEW: "NEW_ENTRY",
        EDIT: "EDIT_INFO_SAME_RATE",
        CHANGE_RATE: "EDIT_INFO_NEW_RATE",
      };
      fd.append("request_type", typeMap[source.requestType] ?? source.requestType);
      fd.append("personnel_type", source.employeeType);

      const submissionData = {
        title: source.title,
        first_name: source.firstName,
        last_name: source.lastName,
        position_name: source.positionName,
        department: source.department,
        sub_department: source.subDepartment,
        employment_region: source.employmentRegion,
        rate_mapping: {
          groupId: source.rateMapping.groupId,
          itemId: source.rateMapping.itemId,
          subItemId: source.rateMapping.subItemId,
          amount: source.rateMapping.amount,
          rateId: source.rateMapping.rateId,
          professionCode: source.rateMapping.professionCode,
        },
        signature_mode: source.signatureMode ?? null,
        signature_draft_data_url:
          source.signatureMode === "NEW" ? source.signature ?? null : null,
      };
      fd.append("submission_data", JSON.stringify(submissionData));

      if (options.prefillUserId) {
        fd.append("target_user_id", String(options.prefillUserId));
      }

      fd.append("citizen_id", source.citizenId);
      fd.append("position_number", source.positionNumber);
      fd.append("department_group", source.department);
      fd.append("main_duty", source.missionGroup);
      fd.append("requested_amount", String(source.rateMapping.amount ?? 0));
      fd.append("effective_date", source.effectiveDate || new Date().toISOString().split("T")[0]);
      fd.append("work_attributes", JSON.stringify(source.workAttributes));

      source.files.forEach((file) => {
        fd.append("files", file);
      });

      if (includeSignature && source.signatureMode === "NEW" && source.signature) {
        const byteString = atob(source.signature.split(",")[1] ?? "");
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: "image/png" });
        fd.append("applicant_signature", blob, `signature_${Date.now()}.png`);
      }

      return fd;
    },
    [options.prefillUserId],
  );

  const {
    autosaveStatus,
    autosaveLastSavedAt,
    autosaveEnabledRef,
    setAutosaveEnabled,
    scheduleAutosave,
    clearAutosaveTimer,
  } = useRequestFormAutosave({
    delayMs: DRAFT_AUTOSAVE_DELAY_MS,
    initiallyEnabled: Boolean(options.initialRequest),
    isOfficerOnBehalfFlow: options.isOfficerOnBehalfFlow,
    latestSubmittingRef,
    latestFormDataRef,
    latestDraftRequestIdRef,
    buildFormData,
    persistDraftRequest: (existingDraftId, form) =>
      existingDraftId ? updateRequest(existingDraftId, form) : createRequest(form),
    onDraftPersisted: (request, existingDraftId) => {
      if (!existingDraftId) {
        setDraftRequestId(request.request_id);
      }
      options.setFormDataField("id", String(request.request_id));
      options.setFormDataField("attachments", request.attachments ?? []);
      options.setOcrPrecheck(request.ocr_precheck ?? null);
      if ((latestFormDataRef.current.files ?? []).length > 0) {
        options.setFormDataField("files", []);
      }
    },
  });

  useEffect(() => {
    latestFormDataRef.current = options.formData;
  }, [options.formData]);

  useEffect(() => {
    latestDraftRequestIdRef.current = draftRequestId;
  }, [draftRequestId]);

  useEffect(() => {
    latestSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  return {
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
    latestSubmittingRef: latestSubmittingRef as MutableRefObject<boolean>,
  };
}

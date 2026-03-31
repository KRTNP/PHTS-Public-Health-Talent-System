"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RequestFormData, RequestWithDetails } from "@/types/request.types";
import { usePrefill } from "@/features/request/core/hooks";
import { useAuth } from "@/components/providers/auth-provider";
import {
  createRequest,
  updateRequest,
  getRequestById,
  submitRequest,
  updateRateMapping,
  confirmAttachments as confirmAttachmentsApi,
  deleteRequestAttachment,
} from "@/features/request/core/api";
import { toast } from "sonner";
import { mapRequestToFormData } from "./request-form-mapper";
import {
  buildMissionGroupPrefill,
  detectProfessionFromPosition,
  extractEffectiveDateFromOcrPrecheck,
  mapEmployeeTypeFromPrefill,
} from "./use-request-form-prefill-utils";
import { useRequestFormAutosave } from "./use-request-form-autosave";
import { useRequestFormOcrPolling } from "./use-request-form-ocr-polling";

const DRAFT_AUTOSAVE_DELAY_MS = 700;
const OCR_POLL_INTERVAL_MS = 2500;

const INITIAL_FORM_DATA: RequestFormData = {
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

const parseGroupItem = (groupId: string, itemId: string, subItemId?: string) => {
  const groupMatch = groupId.match(/\d+/);
  const group_no = groupMatch ? Number(groupMatch[0]) : null;

  // If itemId is empty, return nulls
  if (!itemId || itemId === "__NONE__") {
    return { group_no, item_no: null, sub_item_no: null };
  }

  // Use itemId directly (assuming it matches DB e.g. "2.1", "2.2")
  // If subItemId is provided, use it directly (e.g. "2.2.1")
  return {
    group_no,
    item_no: itemId,
    sub_item_no: subItemId || null,
  };
};


export function useRequestForm(options?: {
  initialRequest?: RequestWithDetails;
  returnPath?: string;
  prefillUserId?: number;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prefill } = usePrefill(options?.prefillUserId);
  const initializedRef = useRef(false);
  const touchedKeysRef = useRef<Set<keyof RequestFormData>>(new Set());
  const [formData, setFormData] = useState<RequestFormData>(INITIAL_FORM_DATA);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ocrPrecheck, setOcrPrecheck] = useState<RequestWithDetails["ocr_precheck"]>(
    options?.initialRequest?.ocr_precheck ?? null,
  );
  const returnPath = options?.returnPath ?? "/user/my-requests";
  const [draftRequestId, setDraftRequestId] = useState<number | null>(null);
  const [prefillOriginal, setPrefillOriginal] = useState<typeof prefill | null>(null);
  const prefillCitizenRef = useRef<string | null>(null);
  const latestFormDataRef = useRef<RequestFormData>(INITIAL_FORM_DATA);
  const latestDraftRequestIdRef = useRef<number | null>(null);
  const latestSubmittingRef = useRef(false);
  const isOfficerOnBehalfFlow = Boolean(
    options?.prefillUserId && user?.role === "PTS_OFFICER" && !options?.initialRequest,
  );

  // Internal setter that must NOT mark the field as user-touched (used by prefill/system updates).
  const setFormDataField = useCallback((key: keyof RequestFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const buildFormData = (source: RequestFormData, includeSignature = true): FormData => {
    const fd = new FormData();

    // Map wizard requestType to backend request_type
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
    if (options?.prefillUserId) {
      fd.append("target_user_id", String(options.prefillUserId));
    }
    fd.append("citizen_id", source.citizenId);
    fd.append("position_number", source.positionNumber);
    fd.append("department_group", source.department);
    fd.append("main_duty", source.missionGroup);
    fd.append("requested_amount", String(source.rateMapping.amount ?? 0));
    fd.append(
      "effective_date",
      source.effectiveDate || new Date().toISOString().split("T")[0]
    );
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
  };
  const {
    autosaveStatus,
    autosaveLastSavedAt,
    autosaveEnabledRef,
    setAutosaveEnabled,
    scheduleAutosave,
    clearAutosaveTimer,
  } = useRequestFormAutosave({
    delayMs: DRAFT_AUTOSAVE_DELAY_MS,
    initiallyEnabled: Boolean(options?.initialRequest),
    isOfficerOnBehalfFlow,
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
      setFormDataField("id", String(request.request_id));
      setFormDataField("attachments", request.attachments ?? []);
      setOcrPrecheck(request.ocr_precheck ?? null);
      if ((latestFormDataRef.current.files ?? []).length > 0) {
        setFormDataField("files", []);
      }
    },
  });

  // Public updater used by UI. Marks the field as touched so subsequent prefill won't overwrite it.
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

  const handleUploadFile = (file: File) => {
    setAutosaveEnabled(true);
    setFormData((prev) => ({
      ...prev,
      // Prevent duplicate selections in the same client session.
      files: prev.files.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified,
      )
        ? prev.files
        : [...prev.files, file],
    }));
    scheduleAutosave();
  };

  const removeFile = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
    if (autosaveEnabledRef.current) {
      scheduleAutosave();
    }
  };

  const removeExistingAttachment = async (attachmentId: number) => {
    if (!draftRequestId) return;
    setIsSubmitting(true);
    try {
      const updated = await deleteRequestAttachment(draftRequestId, attachmentId);
      setFormDataField("attachments", updated.attachments ?? []);
      setOcrPrecheck(updated.ocr_precheck ?? null);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการลบไฟล์แนบ";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!options?.initialRequest || initializedRef.current) return;
    const mapped = mapRequestToFormData(options.initialRequest);
    // Ensure files is initialized as array if coming from mapper as object (should handle mapper update too ideally, but here we can override)
    // Actually mapped.files might be problematic if mapper is not updated.
    // Let's assume mapper returns object, we ignore it for now or convert it?
    // attachments are separate.
    setFormData((prev) => ({
      ...prev,
      ...mapped,
      workAttributes: mapped.workAttributes ?? prev.workAttributes,
      rateMapping: mapped.rateMapping ?? prev.rateMapping,
      files: [], // Reset local files on load, attachments handle existing
    }));
    setDraftRequestId(options.initialRequest.request_id);
    setOcrPrecheck(options.initialRequest.ocr_precheck ?? null);
    setAutosaveEnabled(true);
    initializedRef.current = true;
  }, [options?.initialRequest, setAutosaveEnabled]);

  useEffect(() => {
    latestFormDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    latestDraftRequestIdRef.current = draftRequestId;
  }, [draftRequestId]);

  useEffect(() => {
    latestSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

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

  useEffect(() => {
    if (options?.initialRequest) return;
    const currentCitizenId = String(prefill?.citizen_id ?? "").trim();
    if (!currentCitizenId) return;

    if (!prefillCitizenRef.current) {
      prefillCitizenRef.current = currentCitizenId;
      return;
    }
    if (prefillCitizenRef.current === currentCitizenId) return;

    prefillCitizenRef.current = currentCitizenId;
    touchedKeysRef.current.clear();
    setDraftRequestId(null);
    setPrefillOriginal(prefill);
    setFormData((prev) => ({
      ...INITIAL_FORM_DATA,
      requestType: prev.requestType,
    }));
    setOcrPrecheck(null);
    setAutosaveEnabled(false);
  }, [options?.initialRequest, prefill, setAutosaveEnabled]);

  useEffect(() => {
    if (!prefill) return;
    if (!prefillOriginal) setPrefillOriginal(prefill);

    const setPrefillIfEmpty = (key: keyof RequestFormData, value?: string | null) => {
      if (touchedKeysRef.current.has(key)) return;
      const next = String(value ?? "").trim();
      if (!next) return;
      setFormData((prev) => {
        const currentValue = prev[key];
        const current =
          typeof currentValue === "string"
            ? currentValue.trim()
            : String(currentValue ?? "").trim();
        if (current) return prev;
        return { ...prev, [key]: next };
      });
    };

    if (!touchedKeysRef.current.has("missionGroup")) {
      const missionPrefill = buildMissionGroupPrefill(prefill);
      if (missionPrefill) setPrefillIfEmpty("missionGroup", missionPrefill);
    }

    setPrefillIfEmpty("title", prefill.title);
    setPrefillIfEmpty("firstName", prefill.first_name);
    setPrefillIfEmpty("lastName", prefill.last_name);
    setPrefillIfEmpty("citizenId", prefill.citizen_id);
    setPrefillIfEmpty("positionName", prefill.position_name);
    setPrefillIfEmpty("positionNumber", prefill.position_number);
    setPrefillIfEmpty("department", prefill.department);
    setPrefillIfEmpty("subDepartment", prefill.sub_department);
    setPrefillIfEmpty("effectiveDate", prefill.first_entry_date);

    if (
      !touchedKeysRef.current.has("employeeType") &&
      prefill.employee_type &&
      formData.employeeType === "CIVIL_SERVANT"
    ) {
      setFormDataField("employeeType", mapEmployeeTypeFromPrefill(prefill.employee_type));
    }

    // Auto-detect Profession from Position Name
    if (
      !touchedKeysRef.current.has("professionCode") &&
      !touchedKeysRef.current.has("rateMapping") &&
      prefill.position_name &&
      !formData.professionCode
    ) {
      const detected =
        (typeof (prefill as { profession_code?: string }).profession_code === "string"
          ? (prefill as { profession_code?: string }).profession_code!.trim().toUpperCase()
          : "") ||
        detectProfessionFromPosition(prefill.position_name) ||
        detectProfessionFromPosition(formData.positionName);

      if (detected) {
        setFormDataField("professionCode", detected);
        setFormDataField("rateMapping", {
          ...formData.rateMapping,
          professionCode: detected,
        });
      }
    }
  }, [
    prefill,
    prefillOriginal,
    formData.employeeType,
    formData.professionCode,
    formData.positionName,
    formData.rateMapping,
    setFormDataField,
  ]);

  useEffect(() => {
    if (touchedKeysRef.current.has("firstName") || touchedKeysRef.current.has("lastName")) return;
    if (formData.firstName || formData.lastName) return;
    const fullName = prefill
      ? `${prefill.first_name ?? ""} ${prefill.last_name ?? ""}`.trim()
      : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
    const [first, ...rest] = fullName.split(" ");
    if (!formData.firstName) setFormDataField("firstName", first || "");
    if (!formData.lastName) setFormDataField("lastName", rest.join(" ") || "");
  }, [prefill, user, formData.firstName, formData.lastName, setFormDataField]);

  useEffect(() => {
    if (touchedKeysRef.current.has("effectiveDate")) return;
    if (formData.effectiveDate) return;
    const today = new Date().toISOString().split("T")[0];
    setFormDataField("effectiveDate", today);
  }, [formData.effectiveDate, setFormDataField]);

  const confirmAttachments = async () => {
    setIsSubmitting(true);
    try {
      if (isOfficerOnBehalfFlow && !draftRequestId) {
        return true;
      }

      clearAutosaveTimer();

      const form = buildFormData(formData, false);
      const request = draftRequestId
        ? await updateRequest(draftRequestId, form)
        : await createRequest(form);

      if (!draftRequestId) setDraftRequestId(request.request_id);
      setFormDataField("id", String(request.request_id));
      setFormDataField("attachments", request.attachments ?? []);
      setOcrPrecheck(request.ocr_precheck ?? null);
      setFormDataField("files", []);

      const attachments = request.attachments ?? [];
      const license = attachments.find((att) => att.file_type === "LICENSE");

      if (license?.attachment_id) {
        await confirmAttachmentsApi(request.request_id);
      }

      return true;
    } catch (error) {
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRequestFlow = async () => {
    setIsSubmitting(true);
    try {
      clearAutosaveTimer();

      const form = buildFormData(formData, true);
      const request = draftRequestId
        ? await updateRequest(draftRequestId, form)
        : await createRequest(form);
      setFormDataField("attachments", request.attachments ?? []);
      setOcrPrecheck(request.ocr_precheck ?? null);
      setFormDataField("files", []);

      // Update rate mapping with rateId if available
      const parsed = parseGroupItem(
        formData.rateMapping.groupId,
        formData.rateMapping.itemId,
        formData.rateMapping.subItemId
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
        options?.prefillUserId && user?.role === "PTS_OFFICER"
          ? `/pts-officer/requests/${request.request_id}`
          : returnPath;
      router.push(nextPath);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการส่งคำขอ";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateStep = (): boolean => true;

  return {
    formData,
    updateFormData,
    handleUploadFile,
    removeFile,
    removeExistingAttachment,
    isSubmitting,
    submitRequest: submitRequestFlow,
    validateStep,
    confirmAttachments,
    prefillOriginal,
    autosaveStatus,
    autosaveLastSavedAt,
    ocrPrecheck,
  };
}

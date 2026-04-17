"use client";

import { useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { usePrefill } from "@/features/request/core/hooks";
import type { RequestFormData, RequestWithDetails } from "@/types/request.types";
import { mapRequestToFormData } from "./requestFormMapper";
import {
  buildMissionGroupPrefill,
  detectProfessionFromPosition,
  mapEmployeeTypeFromPrefill,
} from "./useRequestFormPrefillUtils";
import { INITIAL_FORM_DATA } from "./useRequestDraftPersistence";

type UseRequestPrefillStateOptions = {
  initialRequest?: RequestWithDetails;
  prefillUserId?: number;
  user: { firstName?: string; lastName?: string } | null | undefined;
  formData: RequestFormData;
  setFormData: Dispatch<SetStateAction<RequestFormData>>;
  setFormDataField: (key: keyof RequestFormData, value: unknown) => void;
  touchedKeysRef: MutableRefObject<Set<keyof RequestFormData>>;
  setDraftRequestId: (id: number | null) => void;
  setOcrPrecheck: (value: RequestWithDetails["ocr_precheck"]) => void;
  setAutosaveEnabled: (enabled: boolean) => void;
};

export function useRequestPrefillState(options: UseRequestPrefillStateOptions) {
  const { data: prefill } = usePrefill(options.prefillUserId);
  const initializedRef = useRef(false);
  const prefillCitizenRef = useRef<string | null>(null);

  const {
    initialRequest,
    formData,
    setAutosaveEnabled,
    setDraftRequestId,
    setFormData,
    setFormDataField,
    setOcrPrecheck,
    touchedKeysRef,
    user,
  } = options;

  useEffect(() => {
    if (!initialRequest || initializedRef.current) return;
    const mapped = mapRequestToFormData(initialRequest);
    setFormData((prev) => ({
      ...prev,
      ...mapped,
      workAttributes: mapped.workAttributes ?? prev.workAttributes,
      rateMapping: mapped.rateMapping ?? prev.rateMapping,
      files: [],
    }));
    setDraftRequestId(initialRequest.request_id);
    setOcrPrecheck(initialRequest.ocr_precheck ?? null);
    setAutosaveEnabled(true);
    initializedRef.current = true;
  }, [initialRequest, setAutosaveEnabled, setDraftRequestId, setFormData, setOcrPrecheck]);

  useEffect(() => {
    if (initialRequest) return;
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
    setFormData((prev) => ({
      ...INITIAL_FORM_DATA,
      requestType: prev.requestType,
    }));
    setOcrPrecheck(null);
    setAutosaveEnabled(false);
  }, [initialRequest, prefill, setAutosaveEnabled, setDraftRequestId, setFormData, setOcrPrecheck, touchedKeysRef]);

  useEffect(() => {
    if (!prefill) return;

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
  }, [formData.employeeType, formData.positionName, formData.professionCode, formData.rateMapping, prefill, setFormData, setFormDataField, touchedKeysRef]);

  useEffect(() => {
    if (
      touchedKeysRef.current.has("firstName") ||
      touchedKeysRef.current.has("lastName")
    ) {
      return;
    }
    if (formData.firstName || formData.lastName) return;

    const fullName = prefill
      ? `${prefill.first_name ?? ""} ${prefill.last_name ?? ""}`.trim()
      : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

    const [first, ...rest] = fullName.split(" ");
    if (!formData.firstName) setFormDataField("firstName", first || "");
    if (!formData.lastName) setFormDataField("lastName", rest.join(" ") || "");
  }, [formData.firstName, formData.lastName, prefill, setFormDataField, touchedKeysRef, user]);

  useEffect(() => {
    if (touchedKeysRef.current.has("effectiveDate")) return;
    if (formData.effectiveDate) return;
    const today = new Date().toISOString().split("T")[0];
    setFormDataField("effectiveDate", today);
  }, [formData.effectiveDate, setFormDataField, touchedKeysRef]);

  return {
    prefillOriginal: prefill ?? null,
  };
}

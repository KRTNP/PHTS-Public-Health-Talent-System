'use client';

import { useMemo } from "react";
import { useRateHierarchy } from "@/features/master-data/hooks";
import { useRequestDetail } from "@/features/request/core/hooks";
import {
  isEmptyRateMapping,
  normalizeRateMapping,
  resolveRateMappingDisplay,
} from "@/features/request/detail/utils";
import {
  buildAllowanceAttachmentOcrResultMap,
  buildAllowanceOcrDocuments,
} from "@/features/request/shared/ocr/allowanceAttachments";
import { findAssignmentOrderSummary } from "@/features/request/shared/ocr/assignmentOrder";
import { findMemoSummary } from "@/features/request/shared/ocr/ocrDocuments";
import { formatThaiDate } from "@/shared/utils/thai-locale";
import type { RequestWithDetails } from "@/types/request.types";
import type { RequestApprovalDetailComputed } from "./requestApprovalDetail.types";

const PERSONNEL_TYPE_LABELS: Record<string, string> = {
  CIVIL_SERVANT: "ข้าราชการ",
  GOV_EMPLOYEE: "พนักงานราชการ",
  PH_EMPLOYEE: "พนักงานกระทรวงสาธารณสุข",
  TEMP_EMPLOYEE: "ลูกจ้างชั่วคราว",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NEW_ENTRY: "ขอรับสิทธิ พ.ต.ส. ครั้งแรก",
  EDIT_INFO_SAME_RATE: "แก้ไขข้อมูล (อัตราเดิม)",
  EDIT_INFO_NEW_RATE: "แก้ไขข้อมูล (อัตราใหม่)",
};

const WORK_ATTRIBUTE_LABELS: Record<string, string> = {
  operation: "ปฏิบัติการ",
  planning: "วางแผน",
  coordination: "ประสานงาน",
  service: "ให้บริการ",
};

const parseSubmission = (value: RequestWithDetails["submission_data"]) => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
};

const getSubmissionString = (
  submission: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = submission[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

type UseRequestApprovalDetailComputedParams = {
  requestId: string;
  isHistoryView: boolean;
};

type SubmissionFields = {
  submissionTitle?: string;
  submissionFirstName?: string;
  submissionLastName?: string;
  submissionPositionName?: string;
  submissionDepartment?: string;
  submissionSubDepartment?: string;
  submissionPositionNumber?: string;
};

function deriveSubmissionFields(
  submission: Record<string, unknown>,
): SubmissionFields {
  return {
    submissionTitle: getSubmissionString(submission, ["title"]),
    submissionFirstName: getSubmissionString(submission, ["first_name", "firstName"]),
    submissionLastName: getSubmissionString(submission, ["last_name", "lastName"]),
    submissionPositionName: getSubmissionString(submission, ["position_name", "positionName"]),
    submissionDepartment: getSubmissionString(submission, ["department"]),
    submissionSubDepartment: getSubmissionString(submission, ["sub_department", "subDepartment"]),
    submissionPositionNumber: getSubmissionString(submission, ["position_number", "positionNumber"]),
  };
}

export function useRequestApprovalDetailComputed({
  requestId,
  isHistoryView,
}: UseRequestApprovalDetailComputedParams) {
  const { data: request, isLoading } = useRequestDetail(requestId);
  const { data: rateHierarchy } = useRateHierarchy();

  // submission-derived
  const submission = useMemo(
    () => parseSubmission(request?.submission_data) as Record<string, unknown>,
    [request?.submission_data],
  );
  const {
    submissionTitle,
    submissionFirstName,
    submissionLastName,
    submissionPositionName,
    submissionDepartment,
    submissionSubDepartment,
    submissionPositionNumber,
  } = useMemo(() => deriveSubmissionFields(submission), [submission]);

  const requesterName = useMemo(() => {
    const firstName = submissionFirstName ?? request?.requester?.first_name;
    const lastName = submissionLastName ?? request?.requester?.last_name;
    return [submissionTitle, firstName, lastName].filter(Boolean).join(" ").trim() || "-";
  }, [request?.requester, submissionFirstName, submissionLastName, submissionTitle]);

  const positionName = submissionPositionName ?? request?.requester?.position ?? "-";
  const department = submissionDepartment ?? request?.current_department ?? "-";
  const subDepartment = submissionSubDepartment ?? "-";
  const requestDepartmentValue = submissionDepartment ?? request?.current_department ?? null;
  const requestSubDepartmentValue = submissionSubDepartment ?? null;
  const displayId = request ? (request.request_no ?? "-") : requestId;

  // rate-derived
  const rateMapping = useMemo(
    () => normalizeRateMapping(request?.submission_data ?? null),
    [request?.submission_data],
  );
  const rateDisplay = useMemo(
    () => (rateMapping ? resolveRateMappingDisplay(rateMapping, rateHierarchy) : null),
    [rateHierarchy, rateMapping],
  );
  const rateAmount = rateMapping?.amount ?? request?.requested_amount ?? null;
  const isRateMappingEmpty = useMemo(() => isEmptyRateMapping(rateMapping), [rateMapping]);
  const effectiveDateLabel = request?.effective_date
    ? formatThaiDate(request.effective_date, { month: "long" })
    : null;

  // ocr-derived
  const attachments = useMemo(() => request?.attachments ?? [], [request?.attachments]);
  const ocrPrecheck = request?.ocr_precheck ?? null;
  const visibleAttachmentFileNames = useMemo(
    () => attachments.map((file) => file.file_name),
    [attachments],
  );
  const requestOcrResultMap = useMemo(
    () =>
      buildAllowanceAttachmentOcrResultMap({
        requestResults: ocrPrecheck?.results ?? [],
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [ocrPrecheck?.results, visibleAttachmentFileNames],
  );
  const ocrDocuments = useMemo(
    () =>
      buildAllowanceOcrDocuments({
        requestResults: ocrPrecheck?.results ?? [],
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [ocrPrecheck?.results, visibleAttachmentFileNames],
  );
  const assignmentOrderSummary = useMemo(() => {
    if (requesterName === "-" || ocrDocuments.length === 0) return null;
    return findAssignmentOrderSummary(ocrDocuments, requesterName);
  }, [ocrDocuments, requesterName]);
  const memoSummary = useMemo(() => {
    if (requesterName === "-" || ocrDocuments.length === 0) return null;
    return findMemoSummary(ocrDocuments, requesterName);
  }, [ocrDocuments, requesterName]);

  // display-metadata
  const personnelTypeLabel = request?.personnel_type
    ? PERSONNEL_TYPE_LABELS[request.personnel_type] || request.personnel_type
    : "-";
  const requestTypeLabel = request?.request_type
    ? REQUEST_TYPE_LABELS[request.request_type] || request.request_type
    : "-";
  const mainDuty = request?.main_duty || "-";
  const workAttributes = request?.work_attributes
    ? Object.entries(request.work_attributes)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([key]) => WORK_ATTRIBUTE_LABELS[key] || key)
    : [];

  const computed: RequestApprovalDetailComputed = {
    request,
    isHistoryView,
    displayId,
    requesterName,
    requestDepartmentValue,
    requestSubDepartmentValue,
  };

  return {
    request,
    isLoading,
    computed,
    displayId,
    requesterName,
    positionName,
    submissionPositionNumber,
    department,
    subDepartment,
    requestTypeLabel,
    personnelTypeLabel,
    effectiveDateLabel,
    mainDuty,
    workAttributes,
    isRateMappingEmpty,
    rateDisplay,
    rateAmount,
    attachments,
    requestOcrResultMap,
    assignmentOrderSummary,
    memoSummary,
  };
}

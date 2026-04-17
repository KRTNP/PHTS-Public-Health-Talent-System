"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deactivateEligibility,
  deleteEligibilityAttachment,
  reactivateEligibility,
  setPrimaryEligibility,
  uploadEligibilityAttachments,
} from "./api";

function invalidateEligibilityQueries(
  qc: ReturnType<typeof useQueryClient>,
  eligibilityId: number | string,
) {
  qc.invalidateQueries({ queryKey: ["eligibility-detail", String(eligibilityId)] });
  qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
  qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
}

export function useUploadEligibilityAttachments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      formData,
    }: {
      eligibilityId: number | string;
      formData: FormData;
    }) => uploadEligibilityAttachments(eligibilityId, formData),
    onSuccess: (_data, variables) => {
      invalidateEligibilityQueries(qc, variables.eligibilityId);
    },
  });
}

export function useDeleteEligibilityAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      attachmentId,
    }: {
      eligibilityId: number | string;
      attachmentId: number | string;
    }) => deleteEligibilityAttachment(eligibilityId, attachmentId),
    onSuccess: (_data, variables) => {
      invalidateEligibilityQueries(qc, variables.eligibilityId);
    },
  });
}

export function useSetPrimaryEligibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      reason,
    }: {
      eligibilityId: number | string;
      reason?: string;
    }) => setPrimaryEligibility(eligibilityId, reason ? { reason } : undefined),
    onSuccess: (_data, variables) => {
      invalidateEligibilityQueries(qc, variables.eligibilityId);
    },
  });
}

export function useDeactivateEligibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      reason,
    }: {
      eligibilityId: number | string;
      reason?: string;
    }) => deactivateEligibility(eligibilityId, reason ? { reason } : undefined),
    onSuccess: (_data, variables) => {
      invalidateEligibilityQueries(qc, variables.eligibilityId);
    },
  });
}

export function useReactivateEligibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      reason,
    }: {
      eligibilityId: number | string;
      reason?: string;
    }) => reactivateEligibility(eligibilityId, reason ? { reason } : undefined),
    onSuccess: (_data, variables) => {
      invalidateEligibilityQueries(qc, variables.eligibilityId);
    },
  });
}

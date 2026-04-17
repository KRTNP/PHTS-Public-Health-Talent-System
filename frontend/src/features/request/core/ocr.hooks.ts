"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  clearEligibilityAttachmentOcr,
  clearRequestAttachmentOcr,
  runEligibilityAttachmentsOcr,
  runRequestAttachmentsOcr,
} from "./api";

export function useRunRequestAttachmentsOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: number | string;
      payload: {
        attachments: Array<{
          attachment_id: number;
        }>;
      };
    }) => runRequestAttachmentsOcr(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["request", String(variables.requestId)] });
    },
  });
}

export function useClearRequestAttachmentOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      payload,
    }: {
      requestId: number | string;
      payload: {
        file_name: string;
      };
    }) => clearRequestAttachmentOcr(requestId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["request", String(variables.requestId)] });
    },
  });
}

export function useRunEligibilityAttachmentsOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      payload,
    }: {
      eligibilityId: number | string;
      payload: {
        attachments: Array<{
          attachment_id: number;
          source: "eligibility" | "request";
        }>;
      };
    }) => runEligibilityAttachmentsOcr(eligibilityId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

export function useClearEligibilityAttachmentOcr() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      eligibilityId,
      payload,
    }: {
      eligibilityId: number | string;
      payload: {
        file_name: string;
      };
    }) => clearEligibilityAttachmentOcr(eligibilityId, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

/**
 * request module - React query hooks
 *
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
export {
  useApprovalHistory,
  useMyRequests,
  usePendingApprovals,
  useRequestDetail,
} from "./request.queries";
import {
  uploadEligibilityAttachments,
  deleteEligibilityAttachment,
  submitRequest,
  cancelRequest,
  getEligibilityById,
  getEligibilityList,
  getEligibilityPaged,
  getEligibilitySummary,
  setPrimaryEligibility,
  deactivateEligibility,
  reactivateEligibility,
  getPrefill,
  searchPersonnelOptions,
  getMyScopes,
  getMyScopeMembers,
  runRequestAttachmentsOcr,
  clearRequestAttachmentOcr,
  runEligibilityAttachmentsOcr,
  clearEligibilityAttachmentOcr,
  createVerificationSnapshot,
  processAction,
} from "./api";
import type {
  EligibilityRecord,
  EligibilityPagedResult,
  EligibilitySummary,
  PersonnelOption,
  PrefillProfile,
  ScopeWithMembers,
} from "./api";
import type { DisplayScope } from "./utils";

const invalidateNavigation = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["navigation"] });

export function usePrefill(targetUserId?: number | string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["request-prefill", user?.id ?? "anonymous", targetUserId ?? "self"],
    queryFn: () => getPrefill(targetUserId),
    select: (data) => data as PrefillProfile | null,
  });
}

export function usePersonnelOptions(search: string, limit = 20) {
  return useQuery({
    queryKey: ["request-personnel-options", search, limit],
    queryFn: () => searchPersonnelOptions(search, limit),
    enabled: search.trim().length >= 2,
    select: (data) => data as PersonnelOption[],
  });
}

export function useMyScopes() {
  return useQuery({
    queryKey: ["my-scopes"],
    queryFn: getMyScopes,
    select: (data) => data as DisplayScope[],
  });
}

export function useMyScopeMembers() {
  return useQuery({
    queryKey: ["my-scopes-members"],
    queryFn: getMyScopeMembers,
    select: (data) => data as ScopeWithMembers[],
  });
}

export function useEligibilityList(activeOnly = true) {
  return useQuery({
    queryKey: ["eligibility-list", activeOnly ? "active" : "all"],
    queryFn: () => getEligibilityList(activeOnly),
    select: (data) => data as EligibilityRecord[],
  });
}

export function useEligibilitySummary(
  params:
    | boolean
    | {
        active_only?: "0" | "1" | "2";
        profession_code?: string;
        search?: string;
        rate_group?: string;
        department?: string;
        sub_department?: string;
        license_status?: "all" | "active" | "expiring" | "expired";
        alert_filter?: "all" | "any" | "error" | "no-license" | "duplicate" | "upcoming-change";
      } = true,
) {
  return useQuery({
    queryKey: ["eligibility-summary", params],
    queryFn: () => getEligibilitySummary(params),
    select: (data) => data as EligibilitySummary,
  });
}

export function useEligibilityPaged(params: {
  active_only?: "0" | "1" | "2";
  page?: number;
  limit?: number;
  profession_code?: string;
  search?: string;
  rate_group?: string;
  department?: string;
  sub_department?: string;
  license_status?: "all" | "active" | "expiring" | "expired";
  alert_filter?: "all" | "any" | "error" | "no-license" | "duplicate" | "upcoming-change";
}) {
  return useQuery({
    queryKey: ["eligibility-paged", params],
    queryFn: () => getEligibilityPaged(params),
    select: (data) => data as EligibilityPagedResult,
  });
}

export function useEligibilityDetail(id: number | string | undefined) {
  return useQuery({
    queryKey: ["eligibility-detail", id !== undefined ? String(id) : undefined],
    queryFn: () => getEligibilityById(id!),
    enabled: !!id,
    select: (data) => data as EligibilityRecord,
  });
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
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
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
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
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
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
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
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
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
      qc.invalidateQueries({ queryKey: ["eligibility-detail", String(variables.eligibilityId)] });
      qc.invalidateQueries({ queryKey: ["eligibility-paged"] });
      qc.invalidateQueries({ queryKey: ["eligibility-summary"] });
    },
  });
}

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

export function useSubmitRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => submitRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["request", String(id)] });
      invalidateNavigation(qc);
    },
  });
}

export function useCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => cancelRequest(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["request", String(id)] });
      invalidateNavigation(qc);
    },
  });
}

export function useCreateVerificationSnapshot() {
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: {
        master_rate_id: number;
        effective_date: string;
        expiry_date?: string;
        snapshot_data: Record<string, unknown>;
      };
    }) => createVerificationSnapshot(id, payload),
  });
}

export function useProcessAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: {
        action: "APPROVE" | "REJECT" | "RETURN";
        comment?: string;
        signature_base64?: string;
      };
    }) => processAction(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["pending-approvals"] });
      qc.invalidateQueries({ queryKey: ["request", String(variables.id)] });
      invalidateNavigation(qc);
    },
  });
}

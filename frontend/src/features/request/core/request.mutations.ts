"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelRequest, createVerificationSnapshot, processAction, submitRequest } from "./api";

const invalidateNavigation = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: ["navigation"] });

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

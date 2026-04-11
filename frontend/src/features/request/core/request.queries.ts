"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { getApprovalHistory, getMyRequests, getPendingApprovals, getRequestById } from "./api";
import type { RequestWithDetails } from "@/types/request.types";

export function useMyRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-requests", user?.id ?? "anonymous", user?.role ?? "unknown"],
    queryFn: getMyRequests,
    enabled: Boolean(user),
  });
}

export function useRequestDetail(id: number | string | undefined) {
  return useQuery({
    queryKey: ["request", id !== undefined ? String(id) : undefined],
    queryFn: () => getRequestById(id!),
    enabled: !!id,
    retry: (failureCount, error: unknown) => {
      const status =
        typeof error === "object" &&
        error !== null &&
        "response" in error &&
        typeof (error as { response?: { status?: number } }).response === "object"
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

      if (status === 404 || status === 403 || status === 400) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function usePendingApprovals(scope?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "pending-approvals",
      scope ?? "all",
      user?.id ?? "anonymous",
      user?.role ?? "unknown",
    ],
    queryFn: () => getPendingApprovals(scope),
    enabled: Boolean(user),
  });
}

export function useApprovalHistory(params?: {
  view?: "mine" | "team";
  actions?: "important" | "all";
}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      "approval-history",
      params?.view ?? "team",
      params?.actions ?? "important",
      user?.id ?? "anonymous",
      user?.role ?? "unknown",
    ],
    queryFn: () => getApprovalHistory(params),
    enabled: Boolean(user),
    select: (data) => data as unknown as RequestWithDetails[],
  });
}

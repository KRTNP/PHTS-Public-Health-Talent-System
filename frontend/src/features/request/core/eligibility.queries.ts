"use client";

import { useQuery } from "@tanstack/react-query";
import { getEligibilityById, getEligibilityList, getEligibilityPaged, getEligibilitySummary } from "./api";
import type { EligibilityPagedResult, EligibilityRecord, EligibilitySummary } from "./api";

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

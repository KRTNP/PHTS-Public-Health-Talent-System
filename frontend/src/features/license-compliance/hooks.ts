/**
 * license-compliance module - React query hooks
 *
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiParams } from "@/shared/api/types";
import {
  getLicenseComplianceList,
  getLicenseComplianceSummary,
  notifyLicenseCompliance,
} from "./api";

export function useLicenseComplianceSummary() {
  return useQuery({
    queryKey: ["license-compliance-summary"],
    queryFn: getLicenseComplianceSummary,
  });
}

export function useLicenseComplianceList(params?: ApiParams) {
  return useQuery({
    queryKey: ["license-compliance-list", params ?? {}],
    queryFn: () => getLicenseComplianceList(params),
  });
}

export function useNotifyLicenseCompliance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      items: Array<{
        citizen_id: string;
        bucket: "expired" | "30" | "60" | "90";
      }>,
    ) => notifyLicenseCompliance(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["license-compliance-list"] });
      queryClient.invalidateQueries({ queryKey: ["license-compliance-summary"] });
    },
  });
}

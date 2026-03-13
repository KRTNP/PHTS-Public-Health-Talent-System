/**
 * dashboard module - React query hooks
 *
 */
"use client";

import { useQuery } from "@tanstack/react-query";
import { getUserDashboard, getApproverDashboard } from "./api";

export function useUserDashboard() {
  return useQuery({
    queryKey: ["dashboard", "user"],
    queryFn: getUserDashboard,
  });
}

export function useApproverDashboard() {
  return useQuery({
    queryKey: ["dashboard", "approver"],
    queryFn: getApproverDashboard,
  });
}

// Backward-compatible alias during migration.
export const useHeadHrDashboard = useApproverDashboard;

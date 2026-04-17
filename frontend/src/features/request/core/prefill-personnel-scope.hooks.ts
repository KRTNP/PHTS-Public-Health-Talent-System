"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/auth-provider";
import { getMyScopeMembers, getMyScopes, getPrefill, searchPersonnelOptions } from "./api";
import type { PersonnelOption, PrefillProfile, ScopeWithMembers } from "./api";
import type { DisplayScope } from "./utils";

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

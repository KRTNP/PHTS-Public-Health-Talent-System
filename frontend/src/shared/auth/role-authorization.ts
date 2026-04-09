import type { Role } from "@/types/auth";

export const normalizeRole = (role: string | null | undefined): string | null => {
  if (typeof role !== "string") return null;
  const normalized = role.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

export const hasRequiredRole = (
  actualRole: string | null | undefined,
  requiredRole: Role,
): boolean => normalizeRole(actualRole) === requiredRole;

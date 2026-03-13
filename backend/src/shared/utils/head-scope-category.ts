export type HeadScopeCategory = "WARD_SCOPE" | "DEPT_SCOPE";

export const DB_HEAD_SCOPE_ROLE_WARD = "WARD_SCOPE" as const;
export const DB_HEAD_SCOPE_ROLE_DEPT = "DEPT_SCOPE" as const;
type HeadScopeDbRole = typeof DB_HEAD_SCOPE_ROLE_WARD | typeof DB_HEAD_SCOPE_ROLE_DEPT;

export const DB_HEAD_SCOPE_ROLES = [
  DB_HEAD_SCOPE_ROLE_WARD,
  DB_HEAD_SCOPE_ROLE_DEPT,
] as const;
export const DB_HEAD_SCOPE_ROLE_ORDER = [
  DB_HEAD_SCOPE_ROLE_DEPT,
  DB_HEAD_SCOPE_ROLE_WARD,
] as const;
export const DB_HEAD_SCOPE_ROLE_SQL_LIST = DB_HEAD_SCOPE_ROLES.map((role) => `'${role}'`).join(", ");
export const DB_HEAD_SCOPE_ROLE_SQL_ORDER = DB_HEAD_SCOPE_ROLE_ORDER.map((role) => `'${role}'`).join(", ");

const CATEGORY_TO_DB_ROLE: Record<HeadScopeCategory, HeadScopeDbRole> = {
  WARD_SCOPE: DB_HEAD_SCOPE_ROLE_WARD,
  DEPT_SCOPE: DB_HEAD_SCOPE_ROLE_DEPT,
};

export function toHeadScopeCategory(role: string | null | undefined): HeadScopeCategory | null {
  if (role === DB_HEAD_SCOPE_ROLE_WARD) return "WARD_SCOPE";
  if (role === DB_HEAD_SCOPE_ROLE_DEPT) return "DEPT_SCOPE";
  return null;
}

export function toDbHeadScopeRole(role: HeadScopeCategory): HeadScopeDbRole {
  return CATEGORY_TO_DB_ROLE[role];
}

export function toHeadScopeCategoryList(roles: Array<string | null | undefined>): HeadScopeCategory[] {
  return roles
    .map((role) => toHeadScopeCategory(role))
    .filter((role): role is HeadScopeCategory => role !== null);
}

export function isHeadScopeCategory(role: string | null | undefined): role is HeadScopeCategory {
  return role === "WARD_SCOPE" || role === "DEPT_SCOPE";
}

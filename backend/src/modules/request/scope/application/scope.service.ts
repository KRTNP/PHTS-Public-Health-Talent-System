/**
 * PHTS System - Scope Resolution Service
 *
 * Provides database integration for scope-based filtering.
 * Uses special_position from emp_profiles to determine approver scopes.
 */

import { delCache, setJsonCache } from '@shared/utils/cache.js';
import { toDbHeadScopeRole, type HeadScopeCategory } from '@/shared/utils/head-scope-category.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';
import { buildScopesFromSpecialPosition } from '@/modules/request/scope/domain/scope-parser.js';
import {
  ApproverScopes,
  resolveApproverRole,
  inferScopeType,
} from '@/modules/request/scope/domain/scope.utils.js';

const SCOPE_CACHE_TTL_SECONDS = 6 * 60 * 60;
export type InternalHeadRole = HeadScopeCategory;

export async function getActiveHeadScopeRoles(
  userId: number,
  userRole: string,
): Promise<InternalHeadRole[]> {
  if (userRole !== "HEAD_SCOPE") {
    return [];
  }
  const citizenId = await requestRepository.findCitizenIdByUserId(userId);
  return requestRepository.findActiveHeadRoles(userId, citizenId);
}

/**
 * Get approver scopes from database based on special_position
 *
 * The special_position field in emp_profiles contains role assignments like:
 * - "หัวหน้าตึก/หัวหน้างาน-งานไตเทียม" -> WARD_SCOPE
 * - "หัวหน้ากลุ่มงาน-กลุ่มงานเภสัชกรรม" -> DEPT_SCOPE
 *
 * For simplicity, we use the pre-parsed scope role columns
 * from the special_position_group_mapping table if available,
 * or parse from special_position directly.
 */
export async function getApproverScopes(
  userId: number,
  userRole: InternalHeadRole,
): Promise<ApproverScopes> {
  const cacheKey = `${userId}_${userRole}`;
  const redisKey = `scope:${cacheKey}`;

  // Get citizen_id for the user
  const citizenId = await requestRepository.findCitizenIdByUserId(userId);

  if (!citizenId) {
    const emptyScopes = { wardScopes: [], deptScopes: [] };
    await setJsonCache(redisKey, emptyScopes, SCOPE_CACHE_TTL_SECONDS);
    return emptyScopes;
  }

  // Try to get from emp_profiles special_position
  const employeeExists = await requestRepository.findEmployeeExists(citizenId);
  if (!employeeExists) {
    const emptyScopes = { wardScopes: [], deptScopes: [] };
    await setJsonCache(redisKey, emptyScopes, SCOPE_CACHE_TTL_SECONDS);
    return emptyScopes;
  }

  const originalStatus = await requestRepository.findOriginalStatus(citizenId);
  if (!isActiveOriginalStatus(originalStatus)) {
    const emptyScopes = { wardScopes: [], deptScopes: [] };
    await setJsonCache(redisKey, emptyScopes, SCOPE_CACHE_TTL_SECONDS);
    return emptyScopes;
  }

  let mappings = await requestRepository.getScopeMappings(
    userId,
    userRole,
  );
  if (mappings.length === 0) {
    mappings = await requestRepository.getScopeMappingsByCitizenId(
      citizenId,
      userRole,
    );
  }
  if (mappings.length > 0) {
    const wardScopes = mappings
      .filter((m) => m.scope_type === "UNIT")
      .map((m) => m.scope_name);
    const deptScopes = mappings
      .filter((m) => m.scope_type === "DEPT")
      .map((m) => m.scope_name);
    const scopes = { wardScopes, deptScopes };
    await setJsonCache(redisKey, scopes, SCOPE_CACHE_TTL_SECONDS);
    return scopes;
  }

  const specialPosition = await requestRepository.findSpecialPosition(citizenId);
  const scopes = buildScopesFromSpecialPosition(specialPosition);
  await setJsonCache(redisKey, scopes, SCOPE_CACHE_TTL_SECONDS);
  return scopes;
}

/**
 * Check if an approver can access a specific request based on scope
 *
 * @returns true if the approver has scope access to this request
 */
export async function canApproverAccessRequest(
  userId: number,
  userRole: string,
  requestDepartment: string | null | undefined,
  requestSubDepartment: string | null | undefined,
): Promise<boolean> {
  if (userRole === "HEAD_SCOPE") {
    const roles = await getActiveHeadScopeRoles(userId, userRole);
    for (const role of roles) {
      if (await canApproverAccessRequest(userId, role, requestDepartment, requestSubDepartment)) {
        return true;
      }
    }
    return false;
  }

  // Only WARD_SCOPE and DEPT_SCOPE need scope checking
  if (userRole !== "WARD_SCOPE" && userRole !== "DEPT_SCOPE") {
    return true; // Other roles have global access at their step
  }

  const scopes = await getApproverScopes(userId, userRole);

  if (
    userRole === "WARD_SCOPE" &&
    scopes.wardScopes.length === 0 &&
    scopes.deptScopes.length > 0
  ) {
    const deptMatch = scopes.deptScopes.some(
      (scope) => scope.toLowerCase() === (requestDepartment ?? "").toLowerCase(),
    );
    if (deptMatch) {
      return true;
    }
  }

  const wardScopesForCheck =
    userRole === "DEPT_SCOPE" ? [] : scopes.wardScopes;
  const resolvedRole = resolveApproverRole(
    wardScopesForCheck,
    scopes.deptScopes,
    requestDepartment,
    requestSubDepartment,
  );

  // The resolved role must match the user's role
  return resolvedRole === userRole;
}

/**
 * Get pending requests for an approver with scope filtering
 *
 * @param userId - The approver's user ID
 * @param userRole - The approver's role
 * @param stepNo - The current step number for this role
 * @returns SQL WHERE clause additions and parameters for scope filtering
 */
export async function getScopeFilterForApprover(
  userId: number,
  userRole: string,
): Promise<{ whereClause: string; params: any[] } | null> {
  if (userRole === "HEAD_SCOPE") {
    return null;
  }
  // Only WARD_SCOPE and DEPT_SCOPE need scope filtering
  if (userRole !== "WARD_SCOPE" && userRole !== "DEPT_SCOPE") {
    return null; // No additional filtering needed
  }

  const scopes = await getApproverScopes(userId, userRole);

  // If no scopes defined, return no results
  if (scopes.wardScopes.length === 0 && scopes.deptScopes.length === 0) {
    return { whereClause: " AND 1 = 0", params: [] }; // No access
  }

  const { conditions, params } =
    userRole === "WARD_SCOPE"
      ? buildWardConditions([...scopes.wardScopes, ...scopes.deptScopes])
      : buildDeptConditions(scopes.deptScopes);

  if (conditions.length === 0) {
    return { whereClause: " AND 1 = 0", params: [] }; // No access
  }

  return {
    whereClause: ` AND (${conditions.join(" OR ")})`,
    params,
  };
}

/**
 * Clear scope cache (call when user scopes change)
 */
export function clearScopeCache(userId?: number): void {
  if (userId) {
    const wardKey = `${userId}_${toDbHeadScopeRole("WARD_SCOPE")}`;
    const deptKey = `${userId}_${toDbHeadScopeRole("DEPT_SCOPE")}`;
    void delCache(`scope:${wardKey}`, `scope:${deptKey}`);
  } else {
    void delCache();
  }
}

/**
 * Check if a user is the owner of a request (self-approval scenario)
 */
export async function isRequestOwner(
  userId: number,
  requestUserId: number,
): Promise<boolean> {
  return userId === requestUserId;
}

/**
 * Get list of scopes for UI display (multi-scope dropdown)
 *
 * Returns all scopes the user has access to, formatted for display
 */
type DisplayScope = { value: string; label: string; type: "UNIT" | "DEPT" };
type ScopeMember = {
  citizenId: string;
  fullName: string;
  position: string;
  department: string | null;
  subDepartment: string | null;
  userRole: string | null;
  userRoleLabel: string;
};
type DisplayScopeWithMembers = DisplayScope & {
  memberCount: number;
  members: ScopeMember[];
};

function appendDisplayScopes(result: DisplayScope[], scopes: string[]) {
  for (const scope of scopes) {
    const scopeType = inferScopeType(scope);
    if (scopeType === "IGNORE" || scopeType === "UNKNOWN") {
      continue;
    }
    result.push({
      value: scope,
      label: scope,
      type: scopeType === "UNIT" ? "UNIT" : "DEPT",
    });
  }
}

export async function getUserScopesForDisplay(
  userId: number,
  userRole: string,
): Promise<DisplayScope[]> {
  const approverRoles = await getActiveHeadScopeRoles(userId, userRole);
  if (!approverRoles.length) {
    return [];
  }

  const result: DisplayScope[] = [];
  for (const approverRole of approverRoles) {
    const scopes = await getApproverScopes(userId, approverRole);
    appendDisplayScopes(result, scopes.wardScopes);
    appendDisplayScopes(result, scopes.deptScopes);
  }
  return Array.from(
    new Map(result.map((scope) => [`${scope.type}:${scope.value}`, scope])).values(),
  );
}

export async function getUserScopesWithMembers(
  userId: number,
  userRole: string,
): Promise<DisplayScopeWithMembers[]> {
  const scopes = await getUserScopesForDisplay(userId, userRole);
  if (!scopes.length) return [];

  const scopesWithMembers = await Promise.all(
    scopes.map(async (scope) => {
      const inScopeRows = await requestRepository.findEmployeesInScope(scope.type, scope.value);
      const explicitScopeMappings = await requestRepository.findActiveScopeMappingsByScope(
        scope.type,
        scope.value,
      );
      const explicitCitizens = Array.from(
        new Set(explicitScopeMappings.map((row) => row.citizen_id).filter(Boolean)),
      );
      const existingCitizens = new Set(inScopeRows.map((row) => row.citizen_id));
      const missingMappedCitizens = explicitCitizens.filter((citizenId) => !existingCitizens.has(citizenId));
      const mappedRows =
        missingMappedCitizens.length > 0
          ? await requestRepository.findEmployeesByCitizenIds(missingMappedCitizens)
          : [];

      const rows = [...inScopeRows, ...mappedRows];
      const mappingRows = await requestRepository.findActiveScopeMappingsForCitizens(
        rows.map((row) => row.citizen_id).filter(Boolean),
      );
      const scopeMappingsByCitizen = new Map<
        string,
        Array<{ role: "WARD_SCOPE" | "DEPT_SCOPE"; scope_type: "UNIT" | "DEPT"; scope_name: string }>
      >();
      for (const row of mappingRows) {
        const bucket = scopeMappingsByCitizen.get(row.citizen_id) ?? [];
        bucket.push({
          role: row.role,
          scope_type: row.scope_type,
          scope_name: row.scope_name,
        });
        scopeMappingsByCitizen.set(row.citizen_id, bucket);
      }

      const members: ScopeMember[] = rows.map((row) => {
        const fullName = [row.title, row.first_name, row.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        const scopeRole = resolveMemberRoleForScope(
          scope,
          row.department,
          row.sub_department,
          scopeMappingsByCitizen.get(row.citizen_id) ?? [],
        );
        return {
          citizenId: row.citizen_id,
          fullName: fullName || row.citizen_id,
          position: row.position_name || "-",
          department: row.department,
          subDepartment: row.sub_department,
          userRole: scopeRole,
          userRoleLabel: mapUserRoleToThaiLabel(scopeRole),
        };
      });
      return {
        ...scope,
        memberCount: members.length,
        members,
      };
    }),
  );

  return scopesWithMembers;
}

function normalizeScopeValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function resolveMemberRoleForScope(
  scope: DisplayScope,
  memberDepartment: string | null,
  memberSubDepartment: string | null,
  mappings: Array<{ role: "WARD_SCOPE" | "DEPT_SCOPE"; scope_type: "UNIT" | "DEPT"; scope_name: string }>,
): "WARD_SCOPE" | "DEPT_SCOPE" | "USER" {
  const normalizedScopeValue = normalizeScopeValue(scope.value);
  const normalizedDept = normalizeScopeValue(memberDepartment);
  const normalizedSubDept = normalizeScopeValue(memberSubDepartment);

  const hasDeptScopeForCurrentScope = mappings.some(
    (mapping) =>
      mapping.role === "DEPT_SCOPE" &&
      mapping.scope_type === "DEPT" &&
      normalizeScopeValue(mapping.scope_name) === normalizedScopeValue,
  );
  const hasWardScopeForCurrentScope = mappings.some(
    (mapping) =>
      mapping.role === "WARD_SCOPE" &&
      mapping.scope_type === "UNIT" &&
      normalizeScopeValue(mapping.scope_name) === normalizedScopeValue,
  );

  const hasDeptScope = mappings.some(
    (mapping) =>
      mapping.role === "DEPT_SCOPE" &&
      mapping.scope_type === "DEPT" &&
      normalizeScopeValue(mapping.scope_name) === normalizedDept,
  );
  const hasWardScope = mappings.some(
    (mapping) =>
      mapping.role === "WARD_SCOPE" &&
      mapping.scope_type === "UNIT" &&
      normalizeScopeValue(mapping.scope_name) === normalizedSubDept,
  );

  if (scope.type === "DEPT") {
    if (hasDeptScopeForCurrentScope) return "DEPT_SCOPE";
    if (hasWardScopeForCurrentScope) return "WARD_SCOPE";
    if (hasWardScope) return "WARD_SCOPE";
    if (hasDeptScope) return "DEPT_SCOPE";
    return "USER";
  }

  if (hasWardScopeForCurrentScope) return "WARD_SCOPE";
  if (hasDeptScope) return "DEPT_SCOPE";
  return "USER";
}

function mapUserRoleToThaiLabel(role: string | null): string {
  switch ((role ?? "").toUpperCase()) {
    case "ADMIN":
      return "ผู้ดูแลระบบ";
    case "DIRECTOR":
      return "ผู้อำนวยการ";
    case "HEAD_FINANCE":
      return "หัวหน้าการเงิน";
    case "FINANCE_OFFICER":
      return "เจ้าหน้าที่การเงิน";
    case "HEAD_HR":
      return "หัวหน้าทรัพยากรบุคคล";
    case "PTS_OFFICER":
      return "เจ้าหน้าที่ พ.ต.ส.";
    case "WARD_SCOPE":
      return "หัวหน้าตึก/หัวหน้างาน";
    case "DEPT_SCOPE":
      return "หัวหน้ากลุ่มงาน";
    case "HEAD_SCOPE":
      return "หัวหน้างาน";
    case "USER":
      return "ผู้ใช้งานทั่วไป";
    default:
      return "ผู้ใช้งานทั่วไป";
  }
}

/**
 * Get scope filter for a specific selected scope
 *
 * Used when user selects a specific scope from the dropdown
 */
export async function getScopeFilterForSelectedScope(
  userId: number,
  userRole: string,
  selectedScope: string,
): Promise<{ whereClause: string; params: any[] } | null> {
  if (userRole !== "WARD_SCOPE" && userRole !== "DEPT_SCOPE") {
    return null;
  }

  // Verify user has access to this scope
  const scopes = await getApproverScopes(userId, userRole);
  const allUserScopes = [...scopes.wardScopes, ...scopes.deptScopes];

  const hasAccess = allUserScopes.some(
    (s) => s.toLowerCase() === selectedScope.toLowerCase(),
  );

  if (!hasAccess) {
    return { whereClause: " AND 1 = 0", params: [] }; // No access to this scope
  }

  return buildSelectedScopeFilter(selectedScope);
}

function buildWardConditions(scopes: string[]): {
  conditions: string[];
  params: string[];
} {
  const conditions: string[] = [];
  const params: string[] = [];

  for (const scope of scopes) {
    conditions.push("LOWER(e.sub_department) = LOWER(?)");
    params.push(scope);
  }

  for (const scope of scopes) {
    if (inferScopeType(scope) === "DEPT") {
      conditions.push("(LOWER(e.department) = LOWER(?))");
      params.push(scope);
    }
  }

  return { conditions, params };
}

function buildDeptConditions(scopes: string[]): {
  conditions: string[];
  params: string[];
} {
  const conditions: string[] = [];
  const params: string[] = [];

  for (const scope of scopes) {
    conditions.push("LOWER(e.department) = LOWER(?)");
    params.push(scope);
  }

  for (const scope of scopes) {
    if (inferScopeType(scope) === "UNIT") {
      conditions.push("LOWER(e.sub_department) = LOWER(?)");
      params.push(scope);
    }
  }

  return { conditions, params };
}

function buildSelectedScopeFilter(selectedScope: string): {
  whereClause: string;
  params: string[];
} {
  const scopeType = inferScopeType(selectedScope);
  if (scopeType === "UNIT") {
    return {
      whereClause: " AND LOWER(e.sub_department) = LOWER(?)",
      params: [selectedScope],
    };
  }
  if (scopeType === "DEPT") {
    return {
      whereClause: " AND LOWER(e.department) = LOWER(?)",
      params: [selectedScope],
    };
  }
  return { whereClause: " AND 1 = 0", params: [] };
}

function isActiveOriginalStatus(status: string | null): boolean {
  if (!status) return false;
  return status.trim().startsWith("ปฏิบัติงาน");
}

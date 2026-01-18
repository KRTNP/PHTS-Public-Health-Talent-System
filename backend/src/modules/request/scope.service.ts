/**
 * PHTS System - Scope Resolution Service
 *
 * Provides database integration for scope-based filtering.
 * Uses special_position from emp_profiles to determine approver scopes.
 */

import { RowDataPacket } from 'mysql2/promise';
import { query } from '../../config/database.js';
import {
  ApproverScopes,
  parseSpecialPositionScopes,
  removeOverlaps,
  resolveApproverRole,
  inferScopeType,
} from './scope.utils.js';

/**
 * Cache for approver scopes (in-memory, cleared on restart)
 * Key: `${userId}_${role}`, Value: ApproverScopes
 */
const scopeCache = new Map<string, ApproverScopes>();

/**
 * Get approver scopes from database based on special_position
 *
 * The special_position field in emp_profiles contains role assignments like:
 * - "หัวหน้าตึก/หัวหน้างาน-งานไตเทียม" -> HEAD_WARD scope
 * - "หัวหน้ากลุ่มงาน-กลุ่มงานเภสัชกรรม" -> HEAD_DEPT scope
 *
 * For simplicity, we use the pre-parsed HEAD_WARD/HEAD_DEPT columns
 * from the special_position_group_mapping table if available,
 * or parse from special_position directly.
 */
export async function getApproverScopes(
  userId: number,
  userRole: 'HEAD_WARD' | 'HEAD_DEPT',
): Promise<ApproverScopes> {
  const cacheKey = `${userId}_${userRole}`;

  if (scopeCache.has(cacheKey)) {
    return scopeCache.get(cacheKey)!;
  }

  // Get citizen_id for the user
  const userRows = await query<RowDataPacket[]>(
    'SELECT citizen_id FROM users WHERE id = ? LIMIT 1',
    [userId],
  );

  if (!userRows.length) {
    return { wardScopes: [], deptScopes: [] };
  }

  const citizenId = (userRows[0] as any).citizen_id;

  // Try to get from emp_profiles special_position
  const empRows = await query<RowDataPacket[]>(
    `SELECT special_position FROM emp_profiles WHERE citizen_id = ? LIMIT 1`,
    [citizenId],
  );

  if (!empRows.length) {
    // Fallback: try emp_support_staff
    const supportRows = await query<RowDataPacket[]>(
      `SELECT special_position FROM emp_support_staff WHERE citizen_id = ? LIMIT 1`,
      [citizenId],
    );

    if (!supportRows.length) {
      return { wardScopes: [], deptScopes: [] };
    }

    const scopes = parseAndClassifyScopes((supportRows[0] as any).special_position);
    scopeCache.set(cacheKey, scopes);
    return scopes;
  }

  const scopes = parseAndClassifyScopes((empRows[0] as any).special_position);
  scopeCache.set(cacheKey, scopes);
  return scopes;
}

/**
 * Parse special_position and classify into ward/dept scopes
 *
 * The special_position format varies but typically includes patterns like:
 * - "หัวหน้าตึก/หัวหน้างาน-XXX" for HEAD_WARD
 * - "หัวหน้ากลุ่มงาน-XXX" for HEAD_DEPT
 * - Multiple entries separated by semicolons
 */
function parseAndClassifyScopes(specialPosition: string | null): ApproverScopes {
  if (!specialPosition) {
    return { wardScopes: [], deptScopes: [] };
  }

  const allScopes = parseSpecialPositionScopes(specialPosition);
  const wardScopes: string[] = [];
  const deptScopes: string[] = [];

  for (const scope of allScopes) {
    // Check if scope starts with HEAD_WARD pattern
    if (
      scope.includes('หัวหน้าตึก') ||
      scope.includes('หัวหน้างาน-') ||
      scope.match(/^งาน|^หอ|^หน่วย|^ศูนย์/)
    ) {
      // Extract the actual scope name (after the dash if present)
      const parts = scope.split('-');
      const scopeName = parts.length > 1 ? parts.slice(1).join('-').trim() : scope.trim();
      if (scopeName && inferScopeType(scopeName) !== 'IGNORE') {
        wardScopes.push(scopeName);
      }
    }
    // Check if scope starts with HEAD_DEPT pattern
    else if (
      scope.includes('หัวหน้ากลุ่มงาน') ||
      scope.includes('หัวหน้ากลุ่มภารกิจ') ||
      scope.match(/^กลุ่มงาน|^ภารกิจ/)
    ) {
      const parts = scope.split('-');
      const scopeName = parts.length > 1 ? parts.slice(1).join('-').trim() : scope.trim();
      if (scopeName && inferScopeType(scopeName) !== 'IGNORE') {
        deptScopes.push(scopeName);
      }
    }
    // For scopes without prefix, classify by content
    else {
      const scopeType = inferScopeType(scope);
      if (scopeType === 'UNIT') {
        wardScopes.push(scope);
      } else if (scopeType === 'DEPT') {
        deptScopes.push(scope);
      }
    }
  }

  // Remove overlaps: if scope exists in both, keep in deptScopes only
  const cleanedWardScopes = removeOverlaps(wardScopes, deptScopes);

  return {
    wardScopes: cleanedWardScopes,
    deptScopes,
  };
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
  // Only HEAD_WARD and HEAD_DEPT need scope checking
  if (userRole !== 'HEAD_WARD' && userRole !== 'HEAD_DEPT') {
    return true; // Other roles have global access at their step
  }

  const scopes = await getApproverScopes(userId, userRole as 'HEAD_WARD' | 'HEAD_DEPT');

  const resolvedRole = resolveApproverRole(
    scopes.wardScopes,
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
  // Only HEAD_WARD and HEAD_DEPT need scope filtering
  if (userRole !== 'HEAD_WARD' && userRole !== 'HEAD_DEPT') {
    return null; // No additional filtering needed
  }

  const scopes = await getApproverScopes(userId, userRole as 'HEAD_WARD' | 'HEAD_DEPT');

  // If no scopes defined, return no results
  if (scopes.wardScopes.length === 0 && scopes.deptScopes.length === 0) {
    return { whereClause: ' AND 1 = 0', params: [] }; // No access
  }

  // Build WHERE clause based on scope type
  const conditions: string[] = [];
  const params: any[] = [];

  if (userRole === 'HEAD_WARD') {
    // HEAD_WARD matches by sub_department (unit scope)
    for (const scope of scopes.wardScopes) {
      conditions.push('LOWER(e.sub_department) = LOWER(?)');
      params.push(scope);
    }
    // Also match by department if sub_department is NULL
    for (const scope of scopes.wardScopes) {
      if (inferScopeType(scope) === 'DEPT') {
        conditions.push('(e.sub_department IS NULL AND LOWER(e.department) = LOWER(?))');
        params.push(scope);
      }
    }
  } else {
    // HEAD_DEPT matches by department (dept scope)
    for (const scope of scopes.deptScopes) {
      conditions.push('LOWER(e.department) = LOWER(?)');
      params.push(scope);
    }
    // HEAD_DEPT can also have unit scopes
    for (const scope of scopes.deptScopes) {
      if (inferScopeType(scope) === 'UNIT') {
        conditions.push('LOWER(e.sub_department) = LOWER(?)');
        params.push(scope);
      }
    }
  }

  if (conditions.length === 0) {
    return { whereClause: ' AND 1 = 0', params: [] }; // No access
  }

  return {
    whereClause: ` AND (${conditions.join(' OR ')})`,
    params,
  };
}

/**
 * Clear scope cache (call when user scopes change)
 */
export function clearScopeCache(userId?: number): void {
  if (userId) {
    scopeCache.delete(`${userId}_HEAD_WARD`);
    scopeCache.delete(`${userId}_HEAD_DEPT`);
  } else {
    scopeCache.clear();
  }
}

/**
 * Check if a user is the owner of a request (self-approval scenario)
 */
export async function isRequestOwner(userId: number, requestUserId: number): Promise<boolean> {
  return userId === requestUserId;
}

/**
 * Determine if self-approval is allowed for this role and step
 *
 * Per docs: HEAD_WARD and HEAD_DEPT can self-approve when the request
 * is at their step and they are the owner
 */
export function canSelfApprove(userRole: string, currentStep: number): boolean {
  // HEAD_WARD can self-approve at step 1
  if (userRole === 'HEAD_WARD' && currentStep === 1) {
    return true;
  }
  // HEAD_DEPT can self-approve at step 2
  if (userRole === 'HEAD_DEPT' && currentStep === 2) {
    return true;
  }
  return false;
}

/**
 * Get list of scopes for UI display (multi-scope dropdown)
 *
 * Returns all scopes the user has access to, formatted for display
 */
export async function getUserScopesForDisplay(
  userId: number,
  userRole: string,
): Promise<{ value: string; label: string; type: 'UNIT' | 'DEPT' }[]> {
  if (userRole !== 'HEAD_WARD' && userRole !== 'HEAD_DEPT') {
    return [];
  }

  const scopes = await getApproverScopes(userId, userRole as 'HEAD_WARD' | 'HEAD_DEPT');
  const result: { value: string; label: string; type: 'UNIT' | 'DEPT' }[] = [];

  // Add ward scopes (UNIT type)
  for (const scope of scopes.wardScopes) {
    const scopeType = inferScopeType(scope);
    if (scopeType !== 'IGNORE' && scopeType !== 'UNKNOWN') {
      result.push({
        value: scope,
        label: scope,
        type: scopeType as 'UNIT' | 'DEPT',
      });
    }
  }

  // Add dept scopes (DEPT type)
  for (const scope of scopes.deptScopes) {
    const scopeType = inferScopeType(scope);
    if (scopeType !== 'IGNORE' && scopeType !== 'UNKNOWN') {
      result.push({
        value: scope,
        label: scope,
        type: scopeType as 'UNIT' | 'DEPT',
      });
    }
  }

  return result;
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
  if (userRole !== 'HEAD_WARD' && userRole !== 'HEAD_DEPT') {
    return null;
  }

  // Verify user has access to this scope
  const scopes = await getApproverScopes(userId, userRole as 'HEAD_WARD' | 'HEAD_DEPT');
  const allUserScopes = [...scopes.wardScopes, ...scopes.deptScopes];

  const hasAccess = allUserScopes.some(
    (s) => s.toLowerCase() === selectedScope.toLowerCase(),
  );

  if (!hasAccess) {
    return { whereClause: ' AND 1 = 0', params: [] }; // No access to this scope
  }

  const scopeType = inferScopeType(selectedScope);

  if (scopeType === 'UNIT') {
    return {
      whereClause: ' AND LOWER(e.sub_department) = LOWER(?)',
      params: [selectedScope],
    };
  } else if (scopeType === 'DEPT') {
    return {
      whereClause: ' AND LOWER(e.department) = LOWER(?)',
      params: [selectedScope],
    };
  }

  return { whereClause: ' AND 1 = 0', params: [] };
}

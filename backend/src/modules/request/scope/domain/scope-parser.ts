import {
  inferScopeType,
  parseSpecialPositionScopes,
  removeOverlaps,
  type ApproverScopes,
} from '@/modules/request/scope/domain/scope.utils.js';

const EXCLUDED_SCOPE_TOKENS = ['ผู้ช่วยหัวหน้า', 'รองหัวหน้า'];
const WARD_SCOPE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'หัวหน้าตึก/หัวหน้างาน', regex: /^หัวหน้าตึก\/หัวหน้างาน\s*[-:–—]?\s*/u },
  { label: 'หัวหน้าตึก', regex: /^หัวหน้าตึก\s*[-:–—]?\s*/u },
  { label: 'หัวหน้างาน', regex: /^หัวหน้างาน\s*[-:–—]?\s*/u },
];
const DEPT_SCOPE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'หัวหน้ากลุ่มงาน', regex: /^หัวหน้ากลุ่มงาน\s*[-:–—]?\s*/u },
  { label: 'หัวหน้ากลุ่มภารกิจ', regex: /^หัวหน้ากลุ่มภารกิจ\s*[-:–—]?\s*/u },
];

export function buildScopesFromSpecialPosition(
  specialPosition: string | null,
): ApproverScopes {
  if (!specialPosition) {
    return { wardScopes: [], deptScopes: [] };
  }

  const allScopes = parseSpecialPositionScopes(specialPosition);
  const wardScopes: string[] = [];
  const deptScopes: string[] = [];

  const extractScopeName = (
    scope: string,
    patterns: Array<{ label: string; regex: RegExp }>,
  ): { prefix: string; scopeName: string } | null => {
    for (const pattern of patterns) {
      if (!pattern.regex.test(scope)) continue;
      const scopeName = scope.replace(pattern.regex, '').trim();
      return { prefix: pattern.label, scopeName };
    }
    return null;
  };

  const normalizeDeptScopeName = (scopeName: string, prefix: string): string => {
    const name = scopeName.trim();
    if (!name) return name;

    if (prefix === 'หัวหน้ากลุ่มงาน' && !name.includes('กลุ่มงาน') && !name.includes('ภารกิจ')) {
      return `กลุ่มงาน${name}`;
    }
    if (prefix === 'หัวหน้ากลุ่มภารกิจ' && !name.includes('ภารกิจ')) {
      return `ภารกิจ${name}`;
    }
    return name;
  };

  const addScope = (target: string[], scopeName: string): void => {
    if (!scopeName || inferScopeType(scopeName) === 'IGNORE') return;
    target.push(scopeName);
  };

  for (const scope of allScopes) {
    const normalizedScope = scope.trim();
    if (normalizedScope.includes('ตำแหน่งด้านบริหาร')) continue;
    if (EXCLUDED_SCOPE_TOKENS.some((token) => normalizedScope.includes(token))) continue;

    const wardScope = extractScopeName(normalizedScope, WARD_SCOPE_PATTERNS);

    if (wardScope?.scopeName) {
      addScope(wardScopes, wardScope.scopeName);
      continue;
    }

    const deptScope = extractScopeName(normalizedScope, DEPT_SCOPE_PATTERNS);
    if (deptScope?.scopeName) {
      addScope(deptScopes, normalizeDeptScopeName(deptScope.scopeName, deptScope.prefix));
      continue;
    }
  }

  const cleanedWardScopes = removeOverlaps(wardScopes, deptScopes);
  return {
    wardScopes: Array.from(new Set(cleanedWardScopes.map((s) => s.trim()))),
    deptScopes: Array.from(new Set(deptScopes.map((s) => s.trim()))),
  };
}

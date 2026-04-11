'use client';

import { use, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';
import { useMyScopes } from '@/features/request/core/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { RequestApprovalDetailPage } from '@/features/request/detail/pages/RequestApprovalDetailPage';
import type {
  RequestApprovalDetailComputed,
  RequestApprovalDetailConfig,
} from '@/features/request/detail/pages/requestApprovalDetail.types';
import { SectionHeader } from '@/features/request/detail/utils';

const HEAD_SCOPE_ROLE_LABELS = {
  WARD_SCOPE: 'หัวหน้าตึก/หัวหน้างาน',
  DEPT_SCOPE: 'หัวหน้ากลุ่มงาน',
} as const;

type HeadScopeRoleKey = keyof typeof HEAD_SCOPE_ROLE_LABELS;
type UiScopeItem = {
  type: 'UNIT' | 'DEPT';
  label: string;
  value: string;
};

function normalizeForMatch(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[().,/_-]/g, '');
}

function scopeTextMatches(scopeText: string | null | undefined, target: string | null | undefined): boolean {
  const normalizedScope = normalizeForMatch(scopeText);
  const normalizedTarget = normalizeForMatch(target);
  if (!normalizedScope || !normalizedTarget) return false;
  if (normalizedScope === normalizedTarget) return true;

  if (normalizedScope.length >= 6 && normalizedTarget.length >= 6) {
    return normalizedScope.includes(normalizedTarget) || normalizedTarget.includes(normalizedScope);
  }

  return false;
}

export function filterMatchedScopesForActingRole(
  scopes: UiScopeItem[],
  actingHeadScopeRole: HeadScopeRoleKey | undefined,
  requestDepartmentValue: string | null | undefined,
  requestSubDepartmentValue: string | null | undefined,
): UiScopeItem[] {
  if (!Array.isArray(scopes) || !actingHeadScopeRole) return [];

  const normalizedDept = normalizeForMatch(requestDepartmentValue);
  const normalizedSubDept = normalizeForMatch(requestSubDepartmentValue);

  return scopes.filter((scope) => {
    const matchesDept =
      scopeTextMatches(scope.label, normalizedDept) || scopeTextMatches(scope.value, normalizedDept);
    const matchesSubDept =
      scopeTextMatches(scope.label, normalizedSubDept) || scopeTextMatches(scope.value, normalizedSubDept);

    if (actingHeadScopeRole === 'WARD_SCOPE') {
      if (scope.type === 'UNIT') return matchesSubDept;
      if (scope.type === 'DEPT') return matchesDept;
      return false;
    }

    if (scope.type === 'DEPT') return matchesDept;
    if (scope.type === 'UNIT') return matchesSubDept;
    return false;
  });
}

const roleToStep: Record<string, number> = {
  WARD_SCOPE: 1,
  DEPT_SCOPE: 2,
};

const statusToHeadScopeRole: Record<string, HeadScopeRoleKey | undefined> = {
  PENDING_WARD_SCOPE: 'WARD_SCOPE',
  PENDING_DEPT_SCOPE: 'DEPT_SCOPE',
};

const stepToHeadScopeRole: Record<number, HeadScopeRoleKey | undefined> = {
  1: 'WARD_SCOPE',
  2: 'DEPT_SCOPE',
};

type HeadScopeResolve = {
  actingHeadScopeRole: HeadScopeRoleKey | undefined;
  activeHeadScopeRoles: HeadScopeRoleKey[];
  canResolveActingRole: boolean;
  matchedScopes: UiScopeItem[];
  canAct: boolean;
};

function resolveHeadScopeApproval(
  ctx: RequestApprovalDetailComputed,
  user: ReturnType<typeof useAuth>['user'],
  myScopes: UiScopeItem[] | undefined,
): HeadScopeResolve {
  const activeHeadScopeRoles = (user?.head_scope_roles ?? []).filter(
    (role): role is HeadScopeRoleKey => role === 'WARD_SCOPE' || role === 'DEPT_SCOPE',
  );

  const actingHeadScopeRole =
    (ctx.request?.status ? statusToHeadScopeRole[String(ctx.request.status)] : undefined) ??
    (ctx.request?.current_step ? stepToHeadScopeRole[ctx.request.current_step] : undefined);

  const canResolveActingRole =
    !!actingHeadScopeRole && activeHeadScopeRoles.includes(actingHeadScopeRole);

  const matchedScopes = filterMatchedScopesForActingRole(
    Array.isArray(myScopes) ? myScopes : [],
    actingHeadScopeRole,
    ctx.requestDepartmentValue,
    ctx.requestSubDepartmentValue,
  );

  const currentUserSteps =
    user?.role === 'HEAD_SCOPE'
      ? (user.head_scope_roles ?? [])
          .map((role) => roleToStep[role])
          .filter((step): step is number => typeof step === 'number')
      : user?.role && roleToStep[user.role]
        ? [roleToStep[user.role]]
        : [];

  const currentStepForApproval =
    ctx.request?.current_step ?? (actingHeadScopeRole ? roleToStep[actingHeadScopeRole] : -1);
  const isPendingStatus = ctx.request?.status?.startsWith('PENDING');

  const canAct =
    !ctx.isHistoryView &&
    Boolean(isPendingStatus) &&
    currentUserSteps.includes(currentStepForApproval);

  return {
    actingHeadScopeRole,
    activeHeadScopeRoles,
    canResolveActingRole,
    matchedScopes,
    canAct,
  };
}

type HeadScopeRequestDetailPageProps = {
  params: Promise<{ id: string }>;
  basePath: string;
};

export function HeadScopeRequestDetailPage({ params, basePath }: HeadScopeRequestDetailPageProps) {
  const { id } = use(params);
  const { user } = useAuth();
  const { data: myScopes } = useMyScopes();

  const config = useMemo<RequestApprovalDetailConfig>(
    () => ({
      backHref: (isHistoryView) => (isHistoryView ? `${basePath}/history` : `${basePath}/requests`),
      backLabel: (isHistoryView) => (isHistoryView ? 'ประวัติการอนุมัติ' : 'รายการรออนุมัติ'),
      redirectAfterAction: `${basePath}/requests`,
      canAct: (ctx) => resolveHeadScopeApproval(ctx, user, myScopes).canAct,
      leftTopSlot: (ctx) => {
        const { actingHeadScopeRole, canResolveActingRole, matchedScopes } =
          resolveHeadScopeApproval(ctx, user, myScopes);

        if (!actingHeadScopeRole) return null;

        return (
          <Card className="scroll-mt-20 shadow-sm transition-all duration-300 border-primary/30 bg-primary/5">
            <CardContent className="p-6 space-y-3">
              <SectionHeader title="บริบทการอนุมัติ" icon={Building2} />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">กำลังอนุมัติในฐานะ</span>
                <Badge variant="secondary" className="font-medium">
                  {HEAD_SCOPE_ROLE_LABELS[actingHeadScopeRole]}
                </Badge>
                {!canResolveActingRole ? (
                  <span className="text-destructive text-xs">(บัญชีนี้ไม่ได้ถือบทบาทนี้อยู่)</span>
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground">ขอบเขตที่ตรงกับคำขอ:</div>
              {matchedScopes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {matchedScopes.map((scope) => (
                    <Badge key={`${scope.type}:${scope.value}`} variant="outline">
                      {scope.type === 'DEPT' ? 'กลุ่มงาน' : 'หน่วยงาน'}: {scope.label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">ไม่พบขอบเขตที่ตรงแบบตรงตัวกับข้อมูลคำขอนี้</p>
              )}
            </CardContent>
          </Card>
        );
      },
    }),
    [basePath, myScopes, user],
  );

  return <RequestApprovalDetailPage requestId={id} config={config} />;
}

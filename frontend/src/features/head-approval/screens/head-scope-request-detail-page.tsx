'use client';

import { use, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  CheckCircle2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { RequestWithDetails } from '@/types/request.types';
import { useMyScopes, useRequestDetail, useProcessAction } from '@/features/request/core/hooks';
import { useRateHierarchy } from '@/features/master-data/hooks';
import { RequestDetailPageShell } from '@/features/request/detail/shell/RequestDetailPageShell';
import { RequestTimelineCard } from '@/features/request/detail/timeline';
import { SectionHeader } from '@/features/request/detail/utils';
import {
  RequestAmountSummaryCard,
  RequestAttachmentsSection,
  RequestDecisionDialog,
  RequestEligibilityInfoSection,
  RequestRequesterInfoSection,
} from '@/features/request/components/patterns';
import { AttachmentPreviewDialog } from '@/components/common/attachment-preview-dialog';
import { AssignmentOrderSummaryCard, MemoSummaryCard } from '@/features/request/detail/cards';
import { getAttachmentLabel } from '@/features/request/detail/utils';
import { buildAttachmentUrl, isPreviewableFile } from '@/features/request/detail/utils';
import { useAuth } from '@/components/providers/auth-provider';
import {
  findAssignmentOrderSummary,
  findMemoSummary,
  isEmptyRateMapping,
  normalizeRateMapping,
  resolveRateMappingDisplay,
} from '@/features/request/detail/utils';
import { formatThaiDate } from '@/shared/utils/thai-locale';
import {
  buildAllowanceAttachmentOcrPolicy,
  buildAllowanceAttachmentOcrResultMap,
  buildAllowanceOcrDocuments,
} from '@/features/request/shared/ocr/allowanceAttachments';

const parseSubmission = (value: RequestWithDetails['submission_data']) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
};

const getSubmissionString = (
  submission: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = submission[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const PERSONNEL_TYPE_LABELS: Record<string, string> = {
  CIVIL_SERVANT: 'ข้าราชการ',
  GOV_EMPLOYEE: 'พนักงานราชการ',
  PH_EMPLOYEE: 'พนักงานกระทรวงสาธารณสุข',
  TEMP_EMPLOYEE: 'ลูกจ้างชั่วคราว',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  NEW_ENTRY: 'ขอรับสิทธิ พ.ต.ส. ครั้งแรก',
  EDIT_INFO_SAME_RATE: 'แก้ไขข้อมูล (อัตราเดิม)',
  EDIT_INFO_NEW_RATE: 'แก้ไขข้อมูล (อัตราใหม่)',
};

const WORK_ATTRIBUTE_LABELS: Record<string, string> = {
  operation: 'ปฏิบัติการ',
  planning: 'วางแผน',
  coordination: 'ประสานงาน',
  service: 'ให้บริการ',
};

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

  // Fallback for slightly different naming variants (spacing/punctuation/prefixes)
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
    const matchesDept = scopeTextMatches(scope.label, normalizedDept) || scopeTextMatches(scope.value, normalizedDept);
    const matchesSubDept = scopeTextMatches(scope.label, normalizedSubDept) || scopeTextMatches(scope.value, normalizedSubDept);

    if (actingHeadScopeRole === 'WARD_SCOPE') {
      if (scope.type === 'UNIT') {
        return matchesSubDept;
      }
      if (scope.type === 'DEPT') {
        return matchesDept;
      }
      return false;
    }

    if (scope.type === 'DEPT') {
      return matchesDept;
    }
    if (scope.type === 'UNIT') {
      return matchesSubDept;
    }
    return false;
  });
}

type HeadScopeRequestDetailPageProps = {
  params: Promise<{ id: string }>;
  basePath: string;
};

export function HeadScopeRequestDetailPage({ params, basePath }: HeadScopeRequestDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHistoryView = searchParams.get('from') === 'history';
  const { user } = useAuth();
  const { data: request, isLoading } = useRequestDetail(id);
  const { data: myScopes } = useMyScopes();
  const { data: rateHierarchy } = useRateHierarchy();
  const processAction = useProcessAction();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const submission = useMemo(
    () => parseSubmission(request?.submission_data) as Record<string, unknown>,
    [request?.submission_data],
  );
  const submissionTitle = getSubmissionString(submission, ['title']);
  const submissionFirstName = getSubmissionString(submission, ['first_name', 'firstName']);
  const submissionLastName = getSubmissionString(submission, ['last_name', 'lastName']);
  const submissionPositionName = getSubmissionString(submission, ['position_name', 'positionName']);
  const submissionDepartment = getSubmissionString(submission, ['department']);
  const submissionSubDepartment = getSubmissionString(submission, [
    'sub_department',
    'subDepartment',
  ]);
  const submissionPositionNumber = getSubmissionString(submission, [
    'position_number',
    'positionNumber',
  ]);

  const requesterName = useMemo(() => {
    const firstName = submissionFirstName ?? request?.requester?.first_name;
    const lastName = submissionLastName ?? request?.requester?.last_name;
    return [submissionTitle, firstName, lastName].filter(Boolean).join(' ').trim() || '-';
  }, [request?.requester, submissionTitle, submissionFirstName, submissionLastName]);

  const positionName = submissionPositionName ?? request?.requester?.position ?? '-';
  const department = submissionDepartment ?? request?.current_department ?? '-';
  const subDepartment = submissionSubDepartment ?? '-';
  const requestDepartmentValue = submissionDepartment ?? request?.current_department ?? null;
  const requestSubDepartmentValue = submissionSubDepartment ?? null;
  const displayId = request ? (request.request_no ?? '-') : id;

  const rateMapping = useMemo(
    () => normalizeRateMapping(request?.submission_data ?? null),
    [request?.submission_data],
  );
  const rateDisplay = useMemo(() => {
    if (!rateMapping) return null;
    return resolveRateMappingDisplay(rateMapping, rateHierarchy);
  }, [rateMapping, rateHierarchy]);
  const rateAmount = rateMapping?.amount ?? request?.requested_amount ?? null;
  const isRateMappingEmpty = useMemo(() => isEmptyRateMapping(rateMapping), [rateMapping]);
  const effectiveDateLabel = request?.effective_date
    ? formatThaiDate(request.effective_date, { month: 'long' })
    : null;

  const attachments = useMemo(() => request?.attachments ?? [], [request?.attachments]);
  const ocrPrecheck = request?.ocr_precheck ?? null;
  const visibleAttachmentFileNames = useMemo(
    () => attachments.map((file) => file.file_name),
    [attachments],
  );
  const requestOcrResultMap = useMemo(
    () =>
      buildAllowanceAttachmentOcrResultMap({
        requestResults: ocrPrecheck?.results ?? [],
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [ocrPrecheck?.results, visibleAttachmentFileNames],
  );
  const ocrDocuments = useMemo(
    () =>
      buildAllowanceOcrDocuments({
        requestResults: ocrPrecheck?.results ?? [],
        visibleFileNames: visibleAttachmentFileNames,
      }),
    [ocrPrecheck?.results, visibleAttachmentFileNames],
  );
  const assignmentOrderSummary = useMemo(() => {
    if (requesterName === '-' || ocrDocuments.length === 0) {
      return null;
    }
    return findAssignmentOrderSummary(ocrDocuments, requesterName);
  }, [ocrDocuments, requesterName]);
  const memoSummary = useMemo(() => {
    if (requesterName === '-' || ocrDocuments.length === 0) {
      return null;
    }
    return findMemoSummary(ocrDocuments, requesterName);
  }, [ocrDocuments, requesterName]);
  const personnelTypeLabel = request?.personnel_type
    ? PERSONNEL_TYPE_LABELS[request.personnel_type] || request.personnel_type
    : '-';
  const requestTypeLabel = request?.request_type
    ? REQUEST_TYPE_LABELS[request.request_type] || request.request_type
    : '-';
  const mainDuty = request?.main_duty || '-';
  const workAttributes = request?.work_attributes
    ? Object.entries(request.work_attributes)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([key]) => WORK_ATTRIBUTE_LABELS[key] || key)
    : [];

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
  const activeHeadScopeRoles = (user?.head_scope_roles ?? []).filter(
    (role): role is HeadScopeRoleKey => role === 'WARD_SCOPE' || role === 'DEPT_SCOPE',
  );
  const actingHeadScopeRole =
    (request?.status ? statusToHeadScopeRole[String(request.status)] : undefined) ??
    (request?.current_step ? stepToHeadScopeRole[request.current_step] : undefined);
  const canResolveActingRole =
    !!actingHeadScopeRole && activeHeadScopeRoles.includes(actingHeadScopeRole);
  const matchedScopes = useMemo(() => {
    return filterMatchedScopesForActingRole(
      Array.isArray(myScopes) ? myScopes : [],
      actingHeadScopeRole,
      requestDepartmentValue,
      requestSubDepartmentValue,
    );
  }, [actingHeadScopeRole, myScopes, requestDepartmentValue, requestSubDepartmentValue]);

  const currentUserSteps = user?.role === 'HEAD_SCOPE'
    ? (user.head_scope_roles ?? []).map((role) => roleToStep[role]).filter((step): step is number => typeof step === 'number')
    : (user?.role && roleToStep[user.role] ? [roleToStep[user.role]] : []);
  const currentStepForApproval = request?.current_step ?? (actingHeadScopeRole ? roleToStep[actingHeadScopeRole] : -1);
  const isPendingStatus = request?.status?.startsWith('PENDING');
  const canAct =
    !isHistoryView &&
    isPendingStatus &&
    currentUserSteps.includes(currentStepForApproval);
  const backHref = isHistoryView ? `${basePath}/history` : `${basePath}/requests`;
  const backLabel = isHistoryView ? 'ประวัติการอนุมัติ' : 'รายการรออนุมัติ';

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  const handleAction = async () => {
    if (!request || !actionType) return;
    const trimmed = comment.trim();
    if (actionType !== 'approve' && !trimmed) {
      setActionError('กรุณาระบุเหตุผลก่อนดำเนินการ');
      return;
    }
    setActionError(null);
    const actionMap = {
      approve: 'APPROVE',
      reject: 'REJECT',
      return: 'RETURN',
    } as const;

    try {
      await processAction.mutateAsync({
        id: request.request_id,
        payload: { action: actionMap[actionType], comment: trimmed || undefined },
      });
      toast.success('ดำเนินการคำขอเรียบร้อย');
      setActionType(null);
      setComment('');
      router.push(`${basePath}/requests`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เกิดข้อผิดพลาด';
      setActionError(message);
    }
  };

  return (
    <RequestDetailPageShell
      state={isLoading ? 'loading' : request ? 'ready' : 'notFound'}
      backHref={backHref}
      backLabel={backLabel}
      displayId={displayId}
      status={request?.status}
      currentStep={request?.current_step ?? null}
      createdAt={request?.created_at ?? null}
      headerActions={
        request && !isHistoryView ? (
          <>
            <Button
              size="action"
              variant="success"
              disabled={!canAct || processAction.isPending}
              onClick={() => setActionType('approve')}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              อนุมัติ
            </Button>
            <Button
              variant="outline"
              size="action"
              disabled={!canAct || processAction.isPending}
              onClick={() => setActionType('return')}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              ส่งกลับแก้ไข
            </Button>
            <Button
              variant="dangerGhost"
              size="action"
              disabled={!canAct || processAction.isPending}
              onClick={() => setActionType('reject')}
            >
              <XCircle className="mr-2 h-4 w-4" />
              ไม่อนุมัติ
            </Button>
          </>
        ) : null
      }
      left={
        request ? (
          <>
            {actingHeadScopeRole && (
              <Card className="scroll-mt-20 shadow-sm transition-all duration-300 border-primary/30 bg-primary/5">
                <CardContent className="p-6 space-y-3">
                  <SectionHeader title="บริบทการอนุมัติ" icon={Building2} />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">กำลังอนุมัติในฐานะ</span>
                    <Badge variant="secondary" className="font-medium">
                      {HEAD_SCOPE_ROLE_LABELS[actingHeadScopeRole]}
                    </Badge>
                    {!canResolveActingRole && (
                      <span className="text-destructive text-xs">
                        (บัญชีนี้ไม่ได้ถือบทบาทนี้อยู่)
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ขอบเขตที่ตรงกับคำขอ:
                  </div>
                  {matchedScopes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {matchedScopes.map((scope) => (
                        <Badge key={`${scope.type}:${scope.value}`} variant="outline">
                          {scope.type === 'DEPT' ? 'กลุ่มงาน' : 'หน่วยงาน'}: {scope.label}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      ไม่พบขอบเขตที่ตรงแบบตรงตัวกับข้อมูลคำขอนี้
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <RequestRequesterInfoSection
              requesterName={requesterName}
              citizenId={request.citizen_id}
              positionName={positionName}
              positionNumber={submissionPositionNumber || request.current_position_number || '-'}
              department={department}
              subDepartment={subDepartment}
            />

            <RequestEligibilityInfoSection
              requestTypeLabel={requestTypeLabel}
              personnelTypeLabel={personnelTypeLabel}
              effectiveDateLabel={effectiveDateLabel}
              mainDuty={mainDuty}
              workAttributes={workAttributes}
              isRateMappingEmpty={isRateMappingEmpty}
              rateDisplay={rateDisplay}
              rateAmount={rateAmount}
            />

            <RequestAttachmentsSection
              attachments={attachments}
              memoSummary={memoSummary ? <MemoSummaryCard summary={memoSummary} /> : null}
              assignmentOrderSummary={
                assignmentOrderSummary ? (
                  <div className="mt-4">
                    <AssignmentOrderSummaryCard summary={assignmentOrderSummary} />
                  </div>
                ) : null
              }
              getFileUrl={(file) => buildAttachmentUrl(file.file_path)}
              isPreviewable={isPreviewableFile}
              getAttachmentLabel={getAttachmentLabel}
              getOcrMeta={(fileName) => {
                const ocrResult = requestOcrResultMap.get(fileName) ?? null;
                const { documentLabel, notice } = buildAllowanceAttachmentOcrPolicy({
                  fileName,
                  result: ocrResult,
                  personName: requesterName,
                  suppressActions: true,
                  clearableFileNames: new Set<string>(),
                });
                return { documentLabel, notice };
              }}
              onPreview={handlePreview}
            />
          </>
        ) : null
      }
      right={
        request ? (
          <>
            <RequestAmountSummaryCard amount={request.requested_amount} />

            <RequestTimelineCard request={request} />
          </>
        ) : null
      }
      after={
        request ? (
          <>
            <AttachmentPreviewDialog
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              previewUrl={previewUrl}
              previewName={previewName}
            />
            <RequestDecisionDialog
              actionType={actionType}
              requestLabel={`คำขอ ${displayId} - ${requesterName}`}
              comment={comment}
              error={actionError}
              isPending={processAction.isPending}
              onOpenChange={(open) => {
                if (!open) {
                  setActionType(null);
                  setComment('');
                  setActionError(null);
                }
              }}
              onCommentChange={setComment}
              onConfirm={handleAction}
            />
          </>
        ) : null
      }
    />
  );
}

'use client';

import { use, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import type { RequestWithDetails } from '@/types/request.types';
import { useRequestDetail, useProcessAction } from '@/features/request';
import { useRateHierarchy } from '@/features/master-data/hooks';
import {
  RequestAmountSummaryCard,
  RequestAttachmentsSection,
  RequestDecisionDialog,
  RequestEligibilityInfoSection,
  RequestRequesterInfoSection,
} from '@/features/request/components/patterns';
import { RequestDetailPageShell } from '@/features/request/detail/shell/RequestDetailPageShell';
import { RequestTimelineCard } from '@/features/request/detail/timeline';
import { AttachmentPreviewDialog } from '@/components/common/attachment-preview-dialog';
import { AssignmentOrderSummaryCard, MemoSummaryCard } from '@/features/request/detail/cards';
import { getAttachmentLabel } from '@/features/request/detail/utils';
import { buildAttachmentUrl, isPreviewableFile } from '@/features/request/detail/utils';
import {
  isEmptyRateMapping,
  normalizeRateMapping,
  resolveRateMappingDisplay,
} from '@/features/request/detail/utils';
import { findAssignmentOrderSummary } from '@/features/request/shared/ocr/assignmentOrder';
import { findMemoSummary } from '@/features/request/shared/ocr/ocrDocuments';
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

export default function HeadHRRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHistoryView = searchParams.get('from') === 'history';
  const { data: request, isLoading } = useRequestDetail(id);
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

  const canAct =
    !isHistoryView && request?.status === 'PENDING' && request?.current_step === 4;
  const backHref = isHistoryView ? '/head-hr/history' : '/head-hr/requests';
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
      router.push('/head-hr/requests');
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

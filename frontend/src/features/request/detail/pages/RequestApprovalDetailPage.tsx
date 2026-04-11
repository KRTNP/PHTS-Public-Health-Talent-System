'use client';

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AttachmentPreviewDialog } from "@/components/common/attachment-preview-dialog";
import {
  RequestAmountSummaryCard,
  RequestAttachmentsSection,
  RequestDecisionDialog,
  RequestEligibilityInfoSection,
  RequestRequesterInfoSection,
} from "@/features/request/components/patterns";
import { AssignmentOrderSummaryCard, MemoSummaryCard } from "@/features/request/detail/cards";
import { RequestDetailPageShell } from "@/features/request/detail/shell/RequestDetailPageShell";
import { RequestTimelineCard } from "@/features/request/detail/timeline";
import {
  buildAttachmentUrl,
  getAttachmentLabel,
  isPreviewableFile,
} from "@/features/request/detail/utils";
import { useProcessAction } from "@/features/request/core/hooks";
import { buildAllowanceAttachmentOcrPolicy } from "@/features/request/shared/ocr/allowanceAttachments";
import type { RequestApprovalDetailConfig } from "./requestApprovalDetail.types";
import { useRequestApprovalDetailComputed } from "./useRequestApprovalDetailComputed";

type RequestApprovalDetailPageProps = {
  requestId: string;
  config: RequestApprovalDetailConfig;
};

export function RequestApprovalDetailPage({ requestId, config }: RequestApprovalDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHistoryView = searchParams.get("from") === "history";
  const processAction = useProcessAction();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [actionType, setActionType] = useState<"approve" | "reject" | "return" | null>(null);
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    request,
    isLoading,
    computed,
    displayId,
    requesterName,
    positionName,
    submissionPositionNumber,
    department,
    subDepartment,
    requestTypeLabel,
    personnelTypeLabel,
    effectiveDateLabel,
    mainDuty,
    workAttributes,
    isRateMappingEmpty,
    rateDisplay,
    rateAmount,
    attachments,
    requestOcrResultMap,
    assignmentOrderSummary,
    memoSummary,
  } = useRequestApprovalDetailComputed({
    requestId,
    isHistoryView,
  });

  const canAct = config.canAct(computed);
  const backHref = config.backHref(isHistoryView);
  const backLabel = config.backLabel
    ? config.backLabel(isHistoryView)
    : isHistoryView
      ? "ประวัติการอนุมัติ"
      : "รายการรออนุมัติ";

  const handlePreview = (url: string, name: string) => {
    setPreviewUrl(url);
    setPreviewName(name);
    setPreviewOpen(true);
  };

  const handleAction = async () => {
    if (!request || !actionType) return;
    const trimmed = comment.trim();
    if (actionType !== "approve" && !trimmed) {
      setActionError("กรุณาระบุเหตุผลก่อนดำเนินการ");
      return;
    }
    setActionError(null);
    const actionMap = {
      approve: "APPROVE",
      reject: "REJECT",
      return: "RETURN",
    } as const;

    try {
      await processAction.mutateAsync({
        id: request.request_id,
        payload: { action: actionMap[actionType], comment: trimmed || undefined },
      });
      toast.success("ดำเนินการคำขอเรียบร้อย");
      setActionType(null);
      setComment("");
      const redirectPath =
        typeof config.redirectAfterAction === "function"
          ? config.redirectAfterAction(computed)
          : config.redirectAfterAction;
      router.push(redirectPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
      setActionError(message);
    }
  };

  return (
    <RequestDetailPageShell
      state={isLoading ? "loading" : request ? "ready" : "notFound"}
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
              onClick={() => setActionType("approve")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              อนุมัติ
            </Button>
            <Button
              variant="outline"
              size="action"
              disabled={!canAct || processAction.isPending}
              onClick={() => setActionType("return")}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              ส่งกลับแก้ไข
            </Button>
            <Button
              variant="dangerGhost"
              size="action"
              disabled={!canAct || processAction.isPending}
              onClick={() => setActionType("reject")}
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
            {config.leftTopSlot ? config.leftTopSlot(computed) : null}
            <RequestRequesterInfoSection
              requesterName={requesterName}
              citizenId={request.citizen_id}
              positionName={positionName}
              positionNumber={submissionPositionNumber || request.current_position_number || "-"}
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
                  setComment("");
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

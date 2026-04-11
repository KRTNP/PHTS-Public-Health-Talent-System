'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useProcessAction } from "@/features/request/core/hooks";
import type {
  RequestApprovalDetailComputed,
  RequestApprovalDetailConfig,
} from "./requestApprovalDetail.types";

type ApprovalActionType = "approve" | "reject" | "return";

type UseRequestApprovalActionFlowParams = {
  requestId: number | string | undefined;
  config: RequestApprovalDetailConfig;
  computed: RequestApprovalDetailComputed;
};

export function useRequestApprovalActionFlow({
  requestId,
  config,
  computed,
}: UseRequestApprovalActionFlowParams) {
  const router = useRouter();
  const processAction = useProcessAction();
  const [actionType, setActionType] = useState<ApprovalActionType | null>(null);
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const openActionDialog = (type: ApprovalActionType) => {
    setActionType(type);
  };

  const closeActionDialog = () => {
    setActionType(null);
    setComment("");
    setActionError(null);
  };

  const handleActionDialogOpenChange = (open: boolean) => {
    if (!open) closeActionDialog();
  };

  const handleActionConfirm = async () => {
    if (!requestId || !actionType) return;

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
        id: requestId,
        payload: { action: actionMap[actionType], comment: trimmed || undefined },
      });
      toast.success("ดำเนินการคำขอเรียบร้อย");
      closeActionDialog();
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

  return {
    actionType,
    comment,
    actionError,
    isPending: processAction.isPending,
    openActionDialog,
    handleActionDialogOpenChange,
    setComment,
    handleActionConfirm,
  };
}

import type { ReactNode } from "react";
import type { RequestWithDetails } from "@/types/request.types";

export type RequestApprovalDetailComputed = {
  request: RequestWithDetails | undefined;
  isHistoryView: boolean;
  displayId: string;
  requesterName: string;
  requestDepartmentValue: string | null;
  requestSubDepartmentValue: string | null;
};

export type RequestApprovalDetailCoreConfig = {
  backHref: (isHistoryView: boolean) => string;
  backLabel?: (isHistoryView: boolean) => string;
  redirectAfterAction: string | ((ctx: RequestApprovalDetailComputed) => string);
  canAct: (ctx: RequestApprovalDetailComputed) => boolean;
};

export type RequestApprovalDetailUiSlots = {
  leftTopSlot?: (ctx: RequestApprovalDetailComputed) => ReactNode;
};

// Guardrails:
// - Keep core config minimal and behavior-driven.
// - Add optional slots only when reused across roles.
// - Prefer role-level adapters before expanding shared config surface.
export type RequestApprovalDetailConfig = RequestApprovalDetailCoreConfig &
  RequestApprovalDetailUiSlots;

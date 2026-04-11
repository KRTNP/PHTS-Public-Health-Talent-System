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

export type RequestApprovalDetailConfig = {
  backHref: (isHistoryView: boolean) => string;
  backLabel?: (isHistoryView: boolean) => string;
  redirectAfterAction: string | ((ctx: RequestApprovalDetailComputed) => string);
  canAct: (ctx: RequestApprovalDetailComputed) => boolean;
  leftTopSlot?: (ctx: RequestApprovalDetailComputed) => ReactNode;
};

import type {
  RequestApprovalDetailComputed,
  RequestApprovalDetailConfig,
} from "./requestApprovalDetail.types";

const DEFAULT_HISTORY_BACK_LABEL = "ประวัติการอนุมัติ";
const DEFAULT_PENDING_BACK_LABEL = "รายการรออนุมัติ";

function createFixedPendingStepCanAct(step: number) {
  return ({ request, isHistoryView }: RequestApprovalDetailComputed) =>
    !isHistoryView && request?.status === "PENDING" && request?.current_step === step;
}

function createRoleConfig(basePath: string, step: number): RequestApprovalDetailConfig {
  return {
    backHref: (isHistoryView) =>
      isHistoryView ? `${basePath}/history` : `${basePath}/requests`,
    backLabel: (isHistoryView) =>
      isHistoryView ? DEFAULT_HISTORY_BACK_LABEL : DEFAULT_PENDING_BACK_LABEL,
    redirectAfterAction: `${basePath}/requests`,
    canAct: createFixedPendingStepCanAct(step),
  };
}

export const directorRequestApprovalDetailConfig = createRoleConfig("/director", 6);
export const headFinanceRequestApprovalDetailConfig = createRoleConfig("/head-finance", 5);
export const headHrRequestApprovalDetailConfig = createRoleConfig("/head-hr", 4);

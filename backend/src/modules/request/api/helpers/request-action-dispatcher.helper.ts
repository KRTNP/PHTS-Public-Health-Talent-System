import { requestApprovalService } from "@/modules/request/services/approval.service.js";
import { ValidationError } from "@shared/utils/errors.js";
import { decodeSignatureBase64 } from "@/modules/request/api/helpers/request-action.helper.js";

export type RequestActionType = "APPROVE" | "REJECT" | "RETURN";

type DispatchRequestActionParams = {
  action: string;
  requestId: number;
  userId: number;
  userRole: string;
  comment?: unknown;
  signatureBase64?: unknown;
};

export const dispatchRequestAction = async ({
  action,
  requestId,
  userId,
  userRole,
  comment,
  signatureBase64,
}: DispatchRequestActionParams): Promise<unknown> => {
  if (action === "APPROVE") {
    const signatureSnapshot = decodeSignatureBase64(
      typeof signatureBase64 === "string" ? signatureBase64 : undefined,
    );
    return requestApprovalService.approveRequest(
      requestId,
      userId,
      userRole,
      comment as string | undefined,
      signatureSnapshot,
    );
  }

  if (action === "REJECT") {
    return requestApprovalService.rejectRequest(
      requestId,
      userId,
      userRole,
      comment as string,
    );
  }

  if (action === "RETURN") {
    return requestApprovalService.returnRequest(
      requestId,
      userId,
      userRole,
      comment as string,
    );
  }

  throw new ValidationError("Invalid Action");
};

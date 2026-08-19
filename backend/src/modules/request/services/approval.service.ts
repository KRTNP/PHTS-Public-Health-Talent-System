/**
 * Request Module - Approval Service
 *
 * Approval workflow operations: approve, reject, return
 */
import { PoolConnection } from "mysql2/promise";
import { getConnection } from "@config/database.js";
import {
  RequestStatus,
  ActionType,
  PTSRequest,
  STEP_ROLE_MAP,
} from "@/modules/request/contracts/request.types.js";
import { NotificationService } from "@/modules/notification/services/notification.service.js";
import {
  mapRequestRow,
  normalizeDateToYMD,
  getRequestLinkForRole,
} from "@/modules/request/services/helpers.js";
import {
  canApproverAccessRequest,
  isRequestOwner,
  getActiveHeadScopeRoles,
} from "@/modules/request/scope/application/scope.service.js";
import {
  emitAuditEvent,
  AuditEventType,
} from "@/modules/audit/services/audit.service.js";
import { requestRepository } from "@/modules/request/data/repositories/request.repository.js";

// ============================================================================
// Finalization
// ============================================================================

const finalizeRequest = async (
  requestId: number,
  _actorId: number,
  connection: PoolConnection,
) => {
  const request = await requestRepository.findById(requestId, connection);
  if (!request) throw new Error("Request not found during finalization");

  const citizenId = request.citizen_id;
  const amount = request.requested_amount;

  if (!amount || amount <= 0) return;
  if (!request.effective_date) {
    throw new Error("effective_date is required for finalization");
  }

  const effectiveDateStr = normalizeDateToYMD(
    request.effective_date as string | Date,
  );

  // 1. Try rate from submission_data
  let rateId = request.submission_data?.rate_id;

  // 2. Fallback: match by amount + profession
  if (!rateId) {
    let profession = request.personnel_type;
    const positionName = (request as any).position_name;
    if (positionName && typeof positionName === "string") {
      if (positionName.includes("ทันต")) profession = "DENTIST";
      else if (positionName.includes("แพทย์")) profession = "DOCTOR";
      else if (positionName.includes("เภสัช")) profession = "PHARMACIST";
    }

    rateId = await requestRepository.findMatchingRateId(
      amount,
      profession,
      connection,
    );
  }

  if (!rateId) {
    console.warn("[finalizeRequest] No matching rate found for request", {
      requestId: Number(requestId),
    });
    return;
  }

  // Create Eligibility (Deactivate old, Insert new)
  await requestRepository.deactivateEligibility(
    request.user_id ?? null,
    citizenId,
    effectiveDateStr,
    connection,
  );

  await requestRepository.insertEligibility(
    request.user_id ?? null,
    citizenId,
    rateId,
    requestId,
    effectiveDateStr,
    connection,
  );
};

// ============================================================================
// Approval Service Class
// ============================================================================

export class RequestApprovalService {
  private async finalizeApprovedRequest(
    connection: PoolConnection,
    request: PTSRequest,
    requestId: number,
    actorId: number,
  ): Promise<void> {
    await requestRepository.update(
      requestId,
      {
        status: RequestStatus.APPROVED,
        current_step: 7,
        step_started_at: null,
      },
      connection,
    );
    await finalizeRequest(requestId, actorId, connection);
    await NotificationService.notifyUser(
      request.user_id,
      "คำขออนุมัติแล้ว",
      `คำขอเลขที่ ${request.request_no} ได้รับการอนุมัติครบทุกขั้นตอนแล้ว`,
      `/dashboard/user/requests/${requestId}`,
      "APPROVAL",
      connection,
    );
  }

  private async moveToNextApprovalStep(
    connection: PoolConnection,
    requestId: number,
    nextStep: number,
    requestNo: string | undefined,
  ): Promise<void> {
    await requestRepository.update(
      requestId,
      {
        current_step: nextStep,
        step_started_at: new Date(),
      },
      connection,
    );

    const nextRole =
      nextStep === 1 || nextStep === 2 ? "HEAD_SCOPE" : STEP_ROLE_MAP[nextStep];
    if (!nextRole) return;
    await NotificationService.notifyRole(
      nextRole,
      "งานรออนุมัติ",
      `มีคำขอเลขที่ ${requestNo ?? requestId} ส่งต่อมาถึงท่าน`,
      getRequestLinkForRole(nextRole, requestId),
      undefined,
      connection,
    );
  }

  private async loadPendingRequestForAction(
    requestId: number,
    connection: PoolConnection,
    actionVerb: "approve" | "reject" | "return",
    actorRole: string,
  ): Promise<{
    request: PTSRequest;
    empDepartment: unknown;
    empSubDepartment: unknown;
  }> {
    const requestEntity = await requestRepository.findById(
      requestId,
      connection,
    );

    if (!requestEntity) {
      throw new Error("Request not found");
    }

    const request = mapRequestRow(requestEntity);
    const isInternalPtsReturn =
      request.status === RequestStatus.RETURNED &&
      request.return_target === "PTS_OFFICER" &&
      request.current_step === 3 &&
      actorRole === "PTS_OFFICER";
    if (request.status !== RequestStatus.PENDING && !isInternalPtsReturn) {
      throw new Error(`Cannot ${actionVerb} request with status: ${request.status}`);
    }

    return {
      request,
      empDepartment: (requestEntity as any).emp_department,
      empSubDepartment: (requestEntity as any).emp_sub_department,
    };
  }

  private async resolveEffectiveActorRoleForStep(
    requestCurrentStep: number,
    actorId: number,
    actorRole: string,
  ): Promise<string> {
    const expectedRole = STEP_ROLE_MAP[requestCurrentStep];
    let effectiveActorRole = actorRole;

    if (actorRole === "HEAD_SCOPE") {
      const activeRoles = await getActiveHeadScopeRoles(actorId, actorRole);
      if (!activeRoles.includes(expectedRole as "WARD_SCOPE" | "DEPT_SCOPE")) {
        throw new Error(
          `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`,
        );
      }
      effectiveActorRole = expectedRole;
    }

    if (
      actorRole !== "HEAD_SCOPE" &&
      (expectedRole === "WARD_SCOPE" || expectedRole === "DEPT_SCOPE")
    ) {
      throw new Error(
        `Invalid approver role. Expected HEAD_SCOPE, got ${actorRole}`,
      );
    }

    if (expectedRole !== effectiveActorRole) {
      throw new Error(
        `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`,
      );
    }

    return effectiveActorRole;
  }

  private async hasScopePermissionForStep(params: {
    actorId: number;
    effectiveActorRole: string;
    empDepartment: any;
    empSubDepartment: any;
  }): Promise<boolean> {
    const { actorId, effectiveActorRole, empDepartment, empSubDepartment } =
      params;
    if (
      effectiveActorRole !== "WARD_SCOPE" &&
      effectiveActorRole !== "DEPT_SCOPE"
    ) {
      return true;
    }

    return canApproverAccessRequest(
      actorId,
      effectiveActorRole,
      empDepartment,
      empSubDepartment,
    );
  }

  // ============================================================================
  // Approve Request
  // ============================================================================

  async approveRequest(
    requestId: number,
    actorId: number,
    actorRole: string,
    comment?: string,
    signatureSnapshot?: Buffer | null,
  ): Promise<PTSRequest> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const { request, empDepartment, empSubDepartment } =
        await this.loadPendingRequestForAction(
          requestId,
          connection,
          "approve",
          actorRole,
        );

      const effectiveActorRole = await this.resolveEffectiveActorRoleForStep(
        request.current_step,
        actorId,
        actorRole,
      );
      const isSelfApproval = await isRequestOwner(actorId, request.user_id);

      if (
        effectiveActorRole === "WARD_SCOPE" ||
        effectiveActorRole === "DEPT_SCOPE"
      ) {
        const hasScope = await this.hasScopePermissionForStep({
          actorId,
          effectiveActorRole,
          empDepartment,
          empSubDepartment,
        });

        if (!hasScope && !isSelfApproval) {
          throw new Error("คุณไม่มีสิทธิ์อนุมัติคำขอนี้ในขอบเขตการดูแล");
        }

        if (isSelfApproval) {
          throw new Error("Self-approval is not allowed");
        }
      }

      const actorCitizenId =
        (await requestRepository.findCitizenIdByUserId(actorId)) ??
        (await requestRepository.findUserCitizenId(actorId));

      const signatureFromStore =
        signatureSnapshot ??
        (actorCitizenId
          ? await requestRepository.findSignatureSnapshot(
              actorCitizenId,
              connection,
            )
          : null);
      if (!signatureFromStore) {
        throw new Error(
          "ต้องมีลายเซ็นผู้อนุมัติก่อนดำเนินการ กรุณาตั้งค่าลายเซ็นก่อนอนุมัติ",
        );
      }

      await this.performApproval(
        connection,
        request,
        requestId,
        actorId,
        effectiveActorRole,
        comment || null,
        signatureFromStore,
      );

      await emitAuditEvent(
        {
          eventType: AuditEventType.REQUEST_APPROVE,
          entityType: "request",
          entityId: requestId,
          actorId: actorId,
          actorRole: effectiveActorRole,
          actionDetail: {
            request_no: request.request_no,
            step: request.current_step,
            comment: comment || null,
          },
        },
        connection,
      );

      await connection.commit();

      const updatedEntity = await requestRepository.findById(requestId);
      if (!updatedEntity) {
        throw new Error("Request not found after approval update");
      }
      return mapRequestRow(updatedEntity) as PTSRequest;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Reject Request
  // ============================================================================

  async rejectRequest(
    requestId: number,
    actorId: number,
    actorRole: string,
    comment: string,
  ): Promise<PTSRequest> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const { request, empDepartment, empSubDepartment } =
        await this.loadPendingRequestForAction(
          requestId,
          connection,
          "reject",
          actorRole,
        );

      const effectiveActorRole = await this.resolveEffectiveActorRoleForStep(
        request.current_step,
        actorId,
        actorRole,
      );
      if (
        effectiveActorRole === "WARD_SCOPE" ||
        effectiveActorRole === "DEPT_SCOPE"
      ) {
        const hasScope = await this.hasScopePermissionForStep({
          actorId,
          effectiveActorRole,
          empDepartment,
          empSubDepartment,
        });
        if (!hasScope) {
          throw new Error("คุณไม่มีสิทธิ์ปฏิเสธคำขอนี้ในขอบเขตการดูแล");
        }
      }

      if (!comment || comment.trim() === "") {
        throw new Error("Rejection reason is required");
      }

      await requestRepository.insertApproval(
        {
          request_id: requestId,
          actor_id: actorId,
          step_no: request.current_step,
          action: ActionType.REJECT,
          comment: comment,
          signature_snapshot: null,
        },
        connection,
      );

      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.REJECTED,
          step_started_at: null,
        },
        connection,
      );

      await NotificationService.notifyUser(
        request.user_id,
        "คำขอถูกปฏิเสธ",
        `คำขอเลขที่ ${request.request_no} ถูกปฏิเสธ: ${comment}`,
        `/dashboard/user/requests/${requestId}`,
        "APPROVAL",
        connection,
      );

      await emitAuditEvent(
        {
          eventType: AuditEventType.REQUEST_REJECT,
          entityType: "request",
          entityId: requestId,
          actorId: actorId,
          actorRole: effectiveActorRole,
          actionDetail: {
            request_no: request.request_no,
            step: request.current_step,
            comment: comment,
          },
        },
        connection,
      );

      await connection.commit();

      const updatedEntity = await requestRepository.findById(requestId);
      if (!updatedEntity) {
        throw new Error("Request not found after reject update");
      }
      return mapRequestRow(updatedEntity) as PTSRequest;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Return Request
  // ============================================================================

  async returnRequest(
    requestId: number,
    actorId: number,
    actorRole: string,
    comment: string,
  ): Promise<PTSRequest> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const { request, empDepartment, empSubDepartment } =
        await this.loadPendingRequestForAction(
          requestId,
          connection,
          "return",
          actorRole,
        );

      const effectiveActorRole = await this.resolveEffectiveActorRoleForStep(
        request.current_step,
        actorId,
        actorRole,
      );
      if (!comment || comment.trim() === "") {
        throw new Error("Return reason is required");
      }
      if (
        effectiveActorRole === "WARD_SCOPE" ||
        effectiveActorRole === "DEPT_SCOPE"
      ) {
        const hasScope = await this.hasScopePermissionForStep({
          actorId,
          effectiveActorRole,
          empDepartment,
          empSubDepartment,
        });
        if (!hasScope) {
          throw new Error("คุณไม่มีสิทธิ์ส่งคำขอนี้กลับแก้ไขในขอบเขตการดูแล");
        }
      }

      const returnTarget =
        request.current_step >= 4 &&
        ["HEAD_HR", "HEAD_FINANCE", "DIRECTOR"].includes(effectiveActorRole)
          ? "PTS_OFFICER"
          : "APPLICANT";
      const returnFromStep = request.current_step;
      const returnToStep = returnTarget === "PTS_OFFICER" ? 3 : 1;

      await requestRepository.insertApproval(
        {
          request_id: requestId,
          actor_id: actorId,
          step_no: request.current_step,
          action: ActionType.RETURN,
          comment: comment.trim(),
          signature_snapshot: null,
          actor_role: effectiveActorRole,
          return_target: returnTarget,
          return_from_step: returnFromStep,
          return_to_step: returnToStep,
        },
        connection,
      );

      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.RETURNED,
          current_step: returnToStep,
          return_target: returnTarget,
          return_from_step: returnFromStep,
          return_to_step: returnToStep,
          step_started_at: null,
        },
        connection,
      );

      if (returnTarget === "PTS_OFFICER") {
        await NotificationService.notifyRole(
          "PTS_OFFICER",
          "คำขอถูกส่งกลับให้ PTS ตรวจซ้ำ",
          `คำขอเลขที่ ${request.request_no} ถูกส่งกลับให้ PTS ตรวจซ้ำ: ${comment.trim()}`,
          getRequestLinkForRole("PTS_OFFICER", requestId),
          undefined,
          connection,
        );
      } else {
        await NotificationService.notifyUser(
          request.user_id,
          "คำขอถูกส่งคืน",
          `คำขอเลขที่ ${request.request_no} ถูกส่งคืนแก้ไข: ${comment.trim()}`,
          `/dashboard/user/requests/${requestId}`,
          "APPROVAL",
          connection,
        );
      }

      await emitAuditEvent(
        {
          eventType: AuditEventType.REQUEST_RETURN,
          entityType: "request",
          entityId: requestId,
          actorId: actorId,
          actorRole: effectiveActorRole,
          actionDetail: {
            request_no: request.request_no,
            step: returnFromStep,
            return_target: returnTarget,
            return_to_step: returnToStep,
            comment: comment.trim(),
          },
        },
        connection,
      );

      await connection.commit();

      const updatedEntity = await requestRepository.findById(requestId);
      if (!updatedEntity) {
        throw new Error("Request not found after return update");
      }
      return mapRequestRow(updatedEntity) as PTSRequest;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // Internal: Perform Approval
  // ============================================================================

  async performApproval(
    connection: PoolConnection,
    request: PTSRequest,
    requestId: number,
    actorId: number,
    actorRole: string,
    comment: string | null,
    signatureSnapshot: Buffer,
  ): Promise<void> {
    const currentStep = request.current_step;
    const isInternalPtsReturn = request.return_target === "PTS_OFFICER";
    const nextStep = isInternalPtsReturn
      ? (request.return_from_step && request.return_from_step > currentStep
          ? request.return_from_step
          : currentStep + 1)
      : currentStep + 1;

    await requestRepository.insertApproval(
      {
        request_id: requestId,
        actor_id: actorId,
        step_no: currentStep,
        action: ActionType.APPROVE,
        comment: comment,
        signature_snapshot: signatureSnapshot,
        actor_role: actorRole,
      },
      connection,
    );

    if (isInternalPtsReturn) {
      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.PENDING,
          return_target: null,
          return_from_step: null,
          return_to_step: null,
        },
        connection,
      );
    }

    if (nextStep > 6) {
      await this.finalizeApprovedRequest(
        connection,
        request,
        requestId,
        actorId,
      );
      return;
    }
    await this.moveToNextApprovalStep(
      connection,
      requestId,
      nextStep,
      request.request_no,
    );
  }
}

export const requestApprovalService = new RequestApprovalService();

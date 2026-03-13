/**
 * Request Module - Approval Service
 *
 * Approval workflow operations: approve, reject, return, batch approve
 */
import { PoolConnection } from "mysql2/promise";
import { getConnection } from '@config/database.js';
import {
  RequestStatus,
  ActionType,
  PTSRequest,
  STEP_ROLE_MAP,
  ROLE_STEP_MAP,
} from '@/modules/request/contracts/request.types.js';
import { BatchApproveParams, BatchApproveResult } from '@/modules/request/dto/index.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import {
  mapRequestRow,
  normalizeDateToYMD,
  getRequestLinkForRole,
} from '@/modules/request/services/helpers.js';
import {
  canApproverAccessRequest,
  isRequestOwner,
  getActiveHeadScopeRoles,
} from '@/modules/request/scope/application/scope.service.js';
import { emitAuditEvent, AuditEventType } from '@/modules/audit/services/audit.service.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';

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
    console.warn(
      `[finalizeRequest] No matching rate found for Request ${requestId}`,
    );
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
  private resolveAllowedSteps(actorRole: string): number[] {
    const expectedStep = ROLE_STEP_MAP[actorRole as keyof typeof ROLE_STEP_MAP];
    if (actorRole === "DIRECTOR") {
      return [5, 6];
    }
    if (expectedStep !== undefined) {
      return [expectedStep];
    }
    return [];
  }

  private async getApproverSignature(
    actorId: number,
    connection: PoolConnection,
  ): Promise<Buffer> {
    const actorCitizenId =
      (await requestRepository.findCitizenIdByUserId(actorId)) ??
      (await requestRepository.findUserCitizenId(actorId));
    const signatureSnapshot = actorCitizenId
      ? await requestRepository.findSignatureSnapshot(actorCitizenId, connection)
      : null;
    if (!signatureSnapshot) {
      throw new Error(
        "ต้องมีลายเซ็นผู้อนุมัติก่อนดำเนินการ กรุณาตั้งค่าลายเซ็นก่อนอนุมัติ",
      );
    }
    return signatureSnapshot;
  }

  private async processBatchRequest(
    connection: PoolConnection,
    params: {
      requestId: number;
      actorId: number;
      actorRole: string;
      allowedSteps: number[];
      comment: string | undefined;
      signatureSnapshot: Buffer;
      result: BatchApproveResult;
    },
  ): Promise<void> {
    const {
      requestId,
      actorId,
      actorRole,
      allowedSteps,
      comment,
      signatureSnapshot,
      result,
    } = params;
    const requestEntity = await requestRepository.findById(requestId, connection);
    if (!requestEntity) {
      await connection.rollback();
      result.failed.push({ id: requestId, reason: "Request not found" });
      return;
    }

    const request = mapRequestRow(requestEntity);
    if (!allowedSteps.includes(request.current_step)) {
      await connection.rollback();
      result.failed.push({
        id: requestId,
        reason: `Not at allowed step (${allowedSteps.join("/")}) (currently at Step ${request.current_step})`,
      });
      return;
    }

    if (request.status !== RequestStatus.PENDING) {
      await connection.rollback();
      result.failed.push({
        id: requestId,
        reason: `Status is ${request.status}, not PENDING`,
      });
      return;
    }

    await this.performApproval(
      connection,
      request,
      requestId,
      actorId,
      comment || null,
      signatureSnapshot,
    );

    await emitAuditEvent(
      {
        eventType: AuditEventType.REQUEST_APPROVE,
        entityType: "request",
        entityId: requestId,
        actorId: actorId,
        actorRole: actorRole,
        actionDetail: {
          request_no: request.request_no,
          step: request.current_step,
          comment: comment || null,
          batch: true,
        },
      },
      connection,
    );

    await connection.commit();
    result.success.push(requestId);
  }

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
      nextStep === 1 || nextStep === 2
        ? "HEAD_SCOPE"
        : STEP_ROLE_MAP[nextStep];
    if (nextRole === "PTS_OFFICER") {
      try {
        const officerCount = await requestRepository.countActiveOfficers();
        if (officerCount > 0) {
          const officerId = await requestRepository.findLeastLoadedOfficer();
          if (officerId) {
            await requestRepository.updateAssignedOfficer(
              requestId,
              officerId,
              connection,
            );
          }
        }
      } catch (err) {
        console.error("[Approval] Auto-assign PTS_OFFICER failed:", err);
      }
    }
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

      const requestEntity = await requestRepository.findById(
        requestId,
        connection,
      );

      if (!requestEntity) {
        throw new Error("Request not found");
      }

      const request = mapRequestRow(requestEntity);
      const empDepartment = (requestEntity as any).emp_department;
      const empSubDepartment = (requestEntity as any).emp_sub_department;

      if (request.status !== RequestStatus.PENDING) {
        throw new Error(
          `Cannot approve request with status: ${request.status}`,
        );
      }

      const expectedRole = STEP_ROLE_MAP[request.current_step];
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
      if (actorRole !== "HEAD_SCOPE" && (expectedRole === "WARD_SCOPE" || expectedRole === "DEPT_SCOPE")) {
        throw new Error(
          `Invalid approver role. Expected HEAD_SCOPE, got ${actorRole}`,
        );
      }
      if (expectedRole !== effectiveActorRole) {
        throw new Error(
          `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`,
        );
      }

      const isSelfApproval = await isRequestOwner(actorId, request.user_id);

      if (effectiveActorRole === "WARD_SCOPE" || effectiveActorRole === "DEPT_SCOPE") {
        const hasScope = await canApproverAccessRequest(
          actorId,
          effectiveActorRole,
          empDepartment,
          empSubDepartment,
        );

        if (!hasScope && !isSelfApproval) {
          throw new Error(
            "คุณไม่มีสิทธิ์อนุมัติคำขอนี้ในขอบเขตการดูแล",
          );
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

      const requestEntity = await requestRepository.findById(
        requestId,
        connection,
      );

      if (!requestEntity) {
        throw new Error("Request not found");
      }

      const request = mapRequestRow(requestEntity);
      const empDepartment = (requestEntity as any).emp_department;
      const empSubDepartment = (requestEntity as any).emp_sub_department;

      if (request.status !== RequestStatus.PENDING) {
        throw new Error(
          `Cannot reject request with status: ${request.status}`,
        );
      }

      const expectedRole = STEP_ROLE_MAP[request.current_step];
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
      if (actorRole !== "HEAD_SCOPE" && (expectedRole === "WARD_SCOPE" || expectedRole === "DEPT_SCOPE")) {
        throw new Error(
          `Invalid approver role. Expected HEAD_SCOPE, got ${actorRole}`,
        );
      }
      if (expectedRole !== effectiveActorRole) {
        throw new Error(
          `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`,
        );
      }

      if (effectiveActorRole === "WARD_SCOPE" || effectiveActorRole === "DEPT_SCOPE") {
        const hasScope = await canApproverAccessRequest(
          actorId,
          effectiveActorRole,
          empDepartment,
          empSubDepartment,
        );
        if (!hasScope) {
          throw new Error(
            "คุณไม่มีสิทธิ์ปฏิเสธคำขอนี้ในขอบเขตการดูแล",
          );
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

      const requestEntity = await requestRepository.findById(
        requestId,
        connection,
      );

      if (!requestEntity) {
        throw new Error("Request not found");
      }

      const request = mapRequestRow(requestEntity);
      const empDepartment = (requestEntity as any).emp_department;
      const empSubDepartment = (requestEntity as any).emp_sub_department;

      if (request.status !== RequestStatus.PENDING) {
        throw new Error(
          `Cannot return request with status: ${request.status}`,
        );
      }

      const expectedRole = STEP_ROLE_MAP[request.current_step];
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
      if (actorRole !== "HEAD_SCOPE" && (expectedRole === "WARD_SCOPE" || expectedRole === "DEPT_SCOPE")) {
        throw new Error(
          `Invalid approver role. Expected HEAD_SCOPE, got ${actorRole}`,
        );
      }
      if (expectedRole !== effectiveActorRole) {
        throw new Error(
          `Invalid approver role. Expected ${expectedRole}, got ${actorRole}`,
        );
      }

      if (effectiveActorRole === "WARD_SCOPE" || effectiveActorRole === "DEPT_SCOPE") {
        const hasScope = await canApproverAccessRequest(
          actorId,
          effectiveActorRole,
          empDepartment,
          empSubDepartment,
        );
        if (!hasScope) {
          throw new Error(
            "คุณไม่มีสิทธิ์ส่งคำขอนี้กลับแก้ไขในขอบเขตการดูแล",
          );
        }
      }

      await requestRepository.insertApproval(
        {
          request_id: requestId,
          actor_id: actorId,
          step_no: request.current_step,
          action: ActionType.RETURN,
          comment: comment || null,
          signature_snapshot: null,
        },
        connection,
      );

      await requestRepository.update(
        requestId,
        {
          status: RequestStatus.RETURNED,
          current_step: 1,
          assigned_officer_id: null,
          step_started_at: null,
        },
        connection,
      );

      await NotificationService.notifyUser(
        request.user_id,
        "คำขอถูกส่งคืน",
        `คำขอเลขที่ ${request.request_no} ถูกส่งคืนแก้ไข: ${comment}`,
        `/dashboard/user/requests/${requestId}`,
        "APPROVAL",
        connection,
      );

      await emitAuditEvent(
        {
          eventType: AuditEventType.REQUEST_RETURN,
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
  // Batch Approve (DIRECTOR)
  // ============================================================================

  async approveBatch(
    actorId: number,
    actorRole: string,
    params: BatchApproveParams,
  ): Promise<BatchApproveResult> {
    const { requestIds, comment } = params;
    const result: BatchApproveResult = { success: [], failed: [] };

    const allowedSteps = this.resolveAllowedSteps(actorRole);

    if (
      allowedSteps.length === 0 ||
      !allowedSteps.some((s) => s === 5 || s === 6)
    ) {
      throw new Error(`Batch approval not supported for role: ${actorRole}`);
    }

    const connection = await getConnection();

    try {
      const signatureSnapshot = await this.getApproverSignature(
        actorId,
        connection,
      );

      for (const requestId of requestIds) {
        try {
          await connection.beginTransaction();
          await this.processBatchRequest(
            connection,
            {
              requestId,
              actorId,
              actorRole,
              allowedSteps,
              comment,
              signatureSnapshot,
              result,
            },
          );
        } catch (err) {
          await connection.rollback();
          console.error("Error processing request in batch", {
            requestId,
            error: err instanceof Error ? err.message : err,
          });
          result.failed.push({
            id: requestId,
            reason: "Database error or Finalization failed",
          });
        }
      }

      return result;
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
    comment: string | null,
    signatureSnapshot: Buffer,
  ): Promise<void> {
    const currentStep = request.current_step;
    const nextStep = currentStep + 1;

    await requestRepository.insertApproval(
      {
        request_id: requestId,
        actor_id: actorId,
        step_no: currentStep,
        action: ActionType.APPROVE,
        comment: comment,
        signature_snapshot: signatureSnapshot,
      },
      connection,
    );

    if (nextStep > 6) {
      await this.finalizeApprovedRequest(connection, request, requestId, actorId);
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

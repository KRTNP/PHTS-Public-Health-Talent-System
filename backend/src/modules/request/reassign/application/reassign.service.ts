import { getConnection } from '@config/database.js';
import {
  ActionType,
  RequestStatus,
  ROLE_STEP_MAP,
} from '@/modules/request/contracts/request.types.js';
import { requestRepository } from '@/modules/request/data/repositories/request.repository.js';
import { getRequestLinkForRole } from '@/modules/request/services/helpers.js';
import { NotificationService } from '@/modules/notification/services/notification.service.js';
import { AppError, NotFoundError } from '@shared/utils/errors.js';
import type {
  AvailableOfficer,
  PendingOfficerRequest,
  ReassignRequestDTO,
  ReassignResult,
  ReassignmentHistoryItem,
} from '@/modules/request/reassign/domain/reassign.types.js';

const PTS_OFFICER_STEP = ROLE_STEP_MAP.PTS_OFFICER;

export async function getAvailableOfficers(
  currentUserId: number,
): Promise<AvailableOfficer[]> {
  const officers = await requestRepository.findAvailableOfficers(currentUserId);
  return officers.map((officer) => ({
    id: officer.id,
    name: `${officer.first_name} ${officer.last_name}`.trim(),
    citizen_id: officer.citizen_id,
    workload: officer.workload_count,
  }));
}

export async function reassignRequest(
  requestId: number,
  actorId: number,
  dto: ReassignRequestDTO,
): Promise<ReassignResult> {
  const { targetOfficerId, reason } = dto;
  const normalizedReason = reason.trim();
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    const requestEntity = await requestRepository.findById(requestId, connection);
    if (!requestEntity) {
      throw new NotFoundError('Request', requestId);
    }

    const officerCount = await requestRepository.countActiveOfficers();
    if (officerCount < 2) {
      throw new AppError(
        'Reassign requires at least 2 active PTS_OFFICER',
        409,
        'REASSIGN_INSUFFICIENT_OFFICERS',
      );
    }

    if (requestEntity.status !== RequestStatus.PENDING) {
      throw new AppError(
        `Cannot reassign request with status: ${requestEntity.status}`,
        409,
        'REASSIGN_INVALID_STATUS',
        { requestId, status: requestEntity.status },
      );
    }

    if (requestEntity.current_step !== PTS_OFFICER_STEP) {
      throw new AppError(
        `Request is not at PTS Officer stage. Current step: ${requestEntity.current_step}`,
        409,
        'REASSIGN_INVALID_STEP',
        { requestId, currentStep: requestEntity.current_step },
      );
    }

    if (actorId === targetOfficerId) {
      throw new AppError(
        'Cannot reassign to yourself',
        422,
        'REASSIGN_SELF_NOT_ALLOWED',
      );
    }

    const isTargetOfficer = await requestRepository.isActivePtsOfficer(
      targetOfficerId,
      connection,
    );
    if (!isTargetOfficer) {
      throw new AppError(
        'Target officer must be an active PTS_OFFICER',
        422,
        'REASSIGN_TARGET_OFFICER_INVALID',
        { targetOfficerId },
      );
    }

    if (requestEntity.assigned_officer_id === targetOfficerId) {
      throw new AppError(
        'Request is already assigned to target officer',
        409,
        'REASSIGN_DUPLICATE_TARGET',
        { requestId, targetOfficerId },
      );
    }

    await requestRepository.updateAssignedOfficer(requestId, targetOfficerId, connection);

    await requestRepository.insertApproval(
      {
        request_id: requestId,
        actor_id: actorId,
        step_no: requestEntity.current_step,
        action: ActionType.REASSIGN,
        comment: `Reassigned to Officer ID ${targetOfficerId}: ${normalizedReason}`,
        signature_snapshot: null,
      },
      connection,
    );

    await connection.commit();

    await NotificationService.notifyUser(
      targetOfficerId,
      'งานได้รับมอบหมายใหม่',
      `คำขอเลขที่ ${requestEntity.request_no} ถูกโอนมาให้คุณดูแล`,
      getRequestLinkForRole('PTS_OFFICER', requestId),
      'INFO',
    ).catch((error) => {
      console.error('[Notification] enqueue failed after reassign:', error);
    });

    return {
      requestId,
      fromOfficerId: actorId,
      toOfficerId: targetOfficerId,
      reason: normalizedReason,
      reassignedAt: new Date(),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getReassignmentHistory(
  requestId: number,
): Promise<ReassignmentHistoryItem[]> {
  const actions = await requestRepository.findApprovalsWithActor(requestId);
  return actions
    .filter((action) => action.action === ActionType.REASSIGN)
    .map((action) => ({
      actionId: action.action_id,
      actorId: action.actor_id,
      actorName: `${action.actor_first_name} ${action.actor_last_name}`.trim(),
      reason: action.comment?.split(': ')[1] || action.comment || null,
      reassignedAt: action.created_at,
    }));
}

export async function getPendingForOfficer(
  officerId: number,
): Promise<PendingOfficerRequest[]> {
  return requestRepository.findPendingByStepForOfficer(PTS_OFFICER_STEP, officerId);
}

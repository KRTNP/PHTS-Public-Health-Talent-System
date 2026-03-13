import type { RequestSubmissionEntity } from '@/modules/request/contracts/request.entity.js';

export interface ReassignRequestDTO {
  targetOfficerId: number;
  reason: string;
}

export interface ReassignResult {
  requestId: number;
  fromOfficerId: number;
  toOfficerId: number;
  reason: string;
  reassignedAt: Date;
}

export interface AvailableOfficer {
  id: number;
  name: string;
  citizen_id: string;
  workload: number;
}

export interface ReassignmentHistoryItem {
  actionId: number;
  actorId: number;
  actorName: string;
  reason: string | null;
  reassignedAt: Date;
}

export type PendingOfficerRequest = RequestSubmissionEntity;

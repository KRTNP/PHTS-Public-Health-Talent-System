/**
 * DTOs for batch approval operations (DIRECTOR only)
 */

export interface BatchApproveParams {
  requestIds: number[];
  comment?: string;
}

export interface BatchApproveResult {
  success: number[];
  failed: { id: number; reason: string }[];
}

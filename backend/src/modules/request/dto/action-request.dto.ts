/**
 * DTOs for request workflow actions
 */

export interface CancelRequestDTO {
  reason?: string;
}

export interface SubmitRequestDTO {
  requestId: number;
}

export interface ApproveRequestDTO {
  comment?: string;
}

export interface RejectRequestDTO {
  comment: string;
}

export interface ReturnRequestDTO {
  comment: string;
}

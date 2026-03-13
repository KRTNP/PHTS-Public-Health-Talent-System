/**
 * personnel-changes module - API client
 *
 */
import api from "@/shared/api/axios";
import type { ApiResponse } from "@/shared/api/types";

export interface RetirementRecord {
  retirement_id: number;
  citizen_id: string;
  retire_date: string;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  department?: string | null;
}

export interface PersonnelMovementRecord {
  movement_id: number;
  citizen_id: string;
  movement_type: "RESIGN" | "TRANSFER_OUT";
  effective_date: string;
  source_movement_id?: number | null;
  is_manual_entry?: boolean;
  remark?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  position_name?: string | null;
  department?: string | null;
}

export async function getRetirements() {
  const res = await api.get<ApiResponse<RetirementRecord[]>>(
    "/personnel-changes/retirements",
  );
  return res.data.data;
}

export async function createRetirement(payload: {
  citizen_id: string;
  retire_date: string;
  note?: string;
}) {
  const res = await api.post<ApiResponse<RetirementRecord>>(
    "/personnel-changes/retirements",
    payload,
  );
  return res.data.data;
}

export async function updateRetirement(
  retirementId: number,
  payload: { citizen_id: string; retire_date: string; note?: string },
) {
  const res = await api.put<ApiResponse<void>>(
    `/personnel-changes/retirements/${retirementId}`,
    payload,
  );
  return res.data.success;
}

export async function deleteRetirement(retirementId: number) {
  const res = await api.delete<ApiResponse<void>>(
    `/personnel-changes/retirements/${retirementId}`,
  );
  return res.data.success;
}

export async function getPersonnelMovements() {
  const res =
    await api.get<ApiResponse<PersonnelMovementRecord[]>>("/personnel-changes/movements");
  return res.data.data;
}

export async function createPersonnelMovement(payload: {
  citizen_id: string;
  movement_type: "RESIGN" | "TRANSFER_OUT";
  effective_date: string;
  remark?: string;
}) {
  const res = await api.post<ApiResponse<void>>("/personnel-changes/movements", payload);
  return res.data.success;
}

export async function updatePersonnelMovement(
  movementId: number,
  payload: {
    citizen_id: string;
    movement_type: "RESIGN" | "TRANSFER_OUT";
    effective_date: string;
    remark?: string;
  },
) {
  const res = await api.put<ApiResponse<void>>(
    `/personnel-changes/movements/${movementId}`,
    payload,
  );
  return res.data.success;
}

export async function deletePersonnelMovement(movementId: number) {
  const res = await api.delete<ApiResponse<void>>(
    `/personnel-changes/movements/${movementId}`,
  );
  return res.data.success;
}

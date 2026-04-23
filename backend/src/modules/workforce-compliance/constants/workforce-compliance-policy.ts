import { getOpsJobTimezone } from "@config/runtime-config.js";

export const OPS_JOB_TIMEZONE = getOpsJobTimezone();

export const MOVEMENT_RETURN_TYPES = [
  "ENTRY",
  "TRANSFER_IN",
  "REINSTATE",
] as const;

export const LEAVE_REPORT_POLICY = {
  ordain: {
    windowDays: 14,
    overdueDays: 5,
  },
  military: {
    windowDays: 15,
    overdueDays: 7,
  },
} as const;

export function resolveLeavePolicy(leaveType: string) {
  const key = String(leaveType || "").toLowerCase();
  if (key === "ordain") return LEAVE_REPORT_POLICY.ordain;
  if (key === "military") return LEAVE_REPORT_POLICY.military;
  return LEAVE_REPORT_POLICY.military;
}

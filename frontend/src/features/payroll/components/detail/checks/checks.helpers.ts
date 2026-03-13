"use client"

import { formatThaiDate } from "@/shared/utils/thai-locale"
import { getLeaveTypeLabel } from "@/features/leave-management/core/constants"

export const formatThaiShortDate = (value: unknown) => {
  const raw = typeof value === "string" ? value : ""
  const ymd = raw.length >= 10 ? raw.slice(0, 10) : ""
  if (!ymd) return "-"
  return formatThaiDate(`${ymd}T00:00:00`)
}

export const leaveTypeLabel = (leaveType: string) => {
  return getLeaveTypeLabel(leaveType)
}

export const quotaUnitLabel = (unit: string) => {
  if (unit === "business_days") return "วันทำการ"
  if (unit === "calendar_days") return "วันปฏิทิน (นับต่อเนื่องรวมวันหยุด)"
  return unit || "-"
}

export const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const normalizeReturnReportStatus = (
  value: string,
): "pending" | "reported" | null => {
  const normalized = value.trim().toUpperCase()
  if (!normalized) return null
  if (["DONE", "REPORTED", "READY", "รายงานตัวแล้ว"].includes(normalized)) {
    return "reported"
  }
  if (["PENDING", "WAITING", "รอรายงานตัว"].includes(normalized)) {
    return "pending"
  }
  return null
}

export const normalizeLicenseStatusLabel = (value: unknown): string => {
  const status = String(value ?? "").trim().toUpperCase()
  if (!status) return "-"
  if (status === "ACTIVE") return "ใช้งานอยู่"
  if (status === "EXPIRED") return "หมดอายุ"
  if (status === "INACTIVE") return "ไม่ใช้งาน"
  if (status === "REVOKED") return "ถูกเพิกถอน"
  if (status === "SUSPENDED") return "ถูกระงับ"
  if (status === "CANCELLED" || status === "CANCELED") return "ยกเลิก"
  return String(value ?? "-")
}

export const localizePayrollText = (value: string): string => {
  return value
    .replace(/\bno[-\s]?pay\b/gi, "ลาไม่รับค่าตอบแทน")
    .replace(/\bNOT\s+ACTIVE\b/gi, "ไม่ใช้งาน")
    .replace(/ไม่\s*ACTIVE/gi, "ไม่ใช้งาน")
    .replace(/\bINACTIVE\b/gi, "ไม่ใช้งาน")
    .replace(/\bEXPIRED\b/gi, "หมดอายุ")
    .replace(/\bREVOKED\b/gi, "ถูกเพิกถอน")
    .replace(/\bSUSPENDED\b/gi, "ถูกระงับ")
    .replace(/\bCANCELLED\b/gi, "ยกเลิก")
    .replace(/\bCANCELED\b/gi, "ยกเลิก")
    .replace(/\bACTIVE\b/gi, "ใช้งานอยู่")
}

"use client"

import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { toast } from "sonner"
import { resolveProfessionLabel } from "@/shared/constants/profession"
import type { PayrollRow } from "../model/detail.types"
import { escapeCsvValue, formatDateOrEmpty } from "../model/detail.helpers"

type UsePayrollDetailActionsParams = {
  router: AppRouterInstance
  basePath: string
  periodId: string
  selectedProfession: string
  approvalRole: "HR" | "HEAD_FINANCE" | "DIRECTOR"
  canRejectPeriod: boolean
  approveByDirector: { mutateAsync: (periodId: string) => Promise<unknown> }
  approveByHeadFinance: { mutateAsync: (periodId: string) => Promise<unknown> }
  approveByHR: { mutateAsync: (periodId: string) => Promise<unknown> }
  rejectPeriod: { mutateAsync: (args: { periodId: string; payload: { reason: string } }) => Promise<unknown> }
  updatePayoutMutation: {
    mutateAsync: (args: {
      payoutId: number
      payload: {
        eligible_days: number
        deducted_days: number
        retroactive_amount: number
        remark: string | null
      }
    }) => Promise<unknown>
  }
  canEditPayout: boolean
  setSearchQuery: (value: string) => void
  setRateFilter: (value: string) => void
}

const resolveErrorMessage = (error: unknown, fallback: string) => {
  const normalizeKnownMessage = (message: string): string => {
    const trimmed = message.trim()
    const dayLimitMatch = trimmed.match(
      /^eligible_days \+ deducted_days ต้องไม่เกินจำนวนวันในเดือน \((\d+)\)$/,
    )
    if (dayLimitMatch) {
      return `วันมีสิทธิ + วันถูกหัก ต้องไม่เกินจำนวนวันในเดือน (${dayLimitMatch[1]})`
    }
    if (trimmed === "eligible_days ต้องเป็นตัวเลขและต้องมากกว่าหรือเท่ากับ 0") {
      return "วันมีสิทธิต้องเป็นตัวเลขและต้องมากกว่าหรือเท่ากับ 0"
    }
    if (trimmed === "deducted_days ต้องเป็นตัวเลขและต้องมากกว่าหรือเท่ากับ 0") {
      return "วันถูกหักต้องเป็นตัวเลขและต้องมากกว่าหรือเท่ากับ 0"
    }
    if (trimmed === "retroactive_amount ต้องเป็นตัวเลข") {
      return "ยอดตกเบิกต้องเป็นตัวเลข"
    }
    return trimmed
  }

  if (error instanceof Error && error.message?.trim()) return normalizeKnownMessage(error.message)
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return normalizeKnownMessage(maybeMessage)
    }
    const responseData = (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response?.data
    if (typeof responseData?.error === "string" && responseData.error.trim()) {
      return normalizeKnownMessage(responseData.error)
    }
    if (typeof responseData?.message === "string" && responseData.message.trim()) {
      return normalizeKnownMessage(responseData.message)
    }
  }
  return fallback
}

export function usePayrollDetailActions(params: UsePayrollDetailActionsParams) {
  const {
    router,
    basePath,
    periodId,
    selectedProfession,
    approvalRole,
    canRejectPeriod,
    approveByDirector,
    approveByHeadFinance,
    approveByHR,
    rejectPeriod,
    updatePayoutMutation,
    canEditPayout,
    setSearchQuery,
    setRateFilter,
  } = params

  const handleSelectProfession = (code: string) => {
    setSearchQuery("")
    setRateFilter("all")
    if (code === "all") {
      router.push(basePath)
      return
    }
    router.push(`${basePath}/profession/${code}`)
  }

  const handleAction = async (actionType: "approve" | "reject", comment: string) => {
    const trimmed = comment.trim()
    if (actionType === "reject" && !trimmed) {
      toast.error("กรุณาระบุเหตุผลก่อนปฏิเสธ")
      return false
    }
    try {
      if (actionType === "approve") {
        if (approvalRole === "DIRECTOR") {
          await approveByDirector.mutateAsync(periodId)
        } else if (approvalRole === "HEAD_FINANCE") {
          await approveByHeadFinance.mutateAsync(periodId)
        } else {
          await approveByHR.mutateAsync(periodId)
        }
        toast.success("อนุมัติรอบจ่ายเงินแล้ว")
      } else {
        if (!canRejectPeriod) {
          toast.error("บทบาทของคุณไม่สามารถปฏิเสธรอบจ่ายเงินได้")
          return false
        }
        await rejectPeriod.mutateAsync({ periodId, payload: { reason: trimmed } })
        toast.success("ปฏิเสธรอบจ่ายเงินแล้ว")
      }
      return true
    } catch (error) {
      const message = resolveErrorMessage(error, "เกิดข้อผิดพลาด")
      toast.error(message)
      return false
    }
  }

  const handleSavePayoutEdit = async (params: {
    editRow: PayrollRow | null
    editEligibleDays: string
    editDeductedDays: string
    editRetroactiveAmount: string
    editRemark: string
    periodMonth?: number | null
    periodYear?: number | null
  }) => {
    const {
      editRow,
      editEligibleDays,
      editDeductedDays,
      editRetroactiveAmount,
      editRemark,
      periodMonth,
      periodYear,
    } = params
    if (!editRow) return false
    if (!canEditPayout) {
      toast.error("สามารถแก้ไขได้เฉพาะรอบที่ยังเปิดอยู่")
      return false
    }

    const eligibleDays = Number(editEligibleDays)
    const deductedDays = Number(editDeductedDays)
    const retroactiveAmount = Number(editRetroactiveAmount)

    if (!Number.isFinite(eligibleDays) || eligibleDays < 0) {
      toast.error("กรุณากรอกวันมีสิทธิให้ถูกต้อง (>= 0)")
      return false
    }
    if (!Number.isFinite(deductedDays) || deductedDays < 0) {
      toast.error("กรุณากรอกวันถูกหักให้ถูกต้อง (>= 0)")
      return false
    }
    if (!Number.isFinite(retroactiveAmount)) {
      toast.error("กรุณากรอกยอดตกเบิกให้ถูกต้อง")
      return false
    }
    const month = Number(periodMonth ?? 0)
    const rawYear = Number(periodYear ?? 0)
    const year = rawYear > 2400 ? rawYear - 543 : rawYear
    const daysInMonth = month > 0 && year > 0 ? new Date(year, month, 0).getDate() : 0
    if (daysInMonth > 0 && eligibleDays + deductedDays > daysInMonth) {
      toast.error(`วันมีสิทธิ + วันถูกหัก ต้องไม่เกินจำนวนวันในเดือน (${daysInMonth})`)
      return false
    }

    try {
      await updatePayoutMutation.mutateAsync({
        payoutId: editRow.id,
        payload: {
          eligible_days: eligibleDays,
          deducted_days: deductedDays,
          retroactive_amount: retroactiveAmount,
          remark: editRemark?.trim() ? editRemark.trim() : null,
        },
      })
      toast.success("บันทึกการแก้ไขเรียบร้อย")
      return true
    } catch (error) {
      const message = resolveErrorMessage(error, "บันทึกไม่สำเร็จ")
      toast.error(message)
      return false
    }
  }

  const handleExportCsv = (rows: PayrollRow[]) => {
    if (rows.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก")
      return
    }
    const headers = [
      "เลขบัตรประชาชน",
      "คำนำหน้า",
      "ชื่อ-สกุล",
      "ตำแหน่ง",
      "หน่วยงาน",
      "วิชาชีพ",
      "วันหมดอายุใบอนุญาต",
      "กลุ่ม",
      "ข้อ",
      "ข้อย่อย",
      "อัตราเงิน พ.ต.ส.",
      "ตกเบิก",
      "ยอดหัก",
      "รวมจ่าย",
      "ประเด็นที่ต้องตรวจ",
      "หมายเหตุ",
    ]
    const csvRows = rows.map((row) => [
      row.citizenId,
      row.title,
      row.name,
      row.position,
      row.department,
      resolveProfessionLabel(row.professionCode, row.professionCode),
      row.licenseValidUntil ? formatDateOrEmpty(row.licenseValidUntil) : "",
      row.groupNo,
      row.itemNo,
      row.subItemNo,
      row.baseRate,
      row.retroactiveAmount,
      row.deductionAmount,
      row.totalAmount,
      row.issues.map((issue) => issue.label).join("; "),
      row.note ?? "",
    ])
    const csv = [headers, ...csvRows]
      .map((line) => line.map((item) => escapeCsvValue(item)).join(","))
      .join("\n")
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `payroll_${periodId}_${selectedProfession === "all" ? "all" : selectedProfession}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  return {
    handleSelectProfession,
    handleAction,
    handleSavePayoutEdit,
    handleExportCsv,
  }
}

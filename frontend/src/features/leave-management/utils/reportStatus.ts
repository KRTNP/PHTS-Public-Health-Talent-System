import type { LeaveReturnReportEvent } from "@/features/leave-management/core/api"

export type ReturnReportStatus = "pending" | "reported"

export function deriveReturnReportStatus(params: {
  requireReport: boolean
  returnDate?: string | null
  events?: LeaveReturnReportEvent[] | null
}): ReturnReportStatus | undefined {
  const { requireReport, returnDate, events } = params
  if (!requireReport) return undefined

  const latestEvent = Array.isArray(events) && events.length > 0
    ? [...events].sort((a, b) => a.report_date.localeCompare(b.report_date)).at(-1)
    : null
  if (latestEvent) {
    const isFinalReturn = !latestEvent.resume_date && !latestEvent.resume_study_program
    return isFinalReturn ? "reported" : "pending"
  }

  return returnDate ? "reported" : "pending"
}

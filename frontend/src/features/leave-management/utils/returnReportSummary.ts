type ReturnReportEventLike = {
  report_date: string
  resume_date?: string | null
  resume_study_program?: string | null
}

export function buildReturnReportSummary(events: ReturnReportEventLike[]) {
  if (!events.length) {
    return {
      return_report_status: "PENDING" as const,
      return_date: undefined,
    }
  }

  const latestEvent = [...events].sort((a, b) => a.report_date.localeCompare(b.report_date)).at(-1)
  const isFinalReturn = latestEvent && !latestEvent.resume_date && !latestEvent.resume_study_program

  return {
    return_report_status: isFinalReturn ? ("DONE" as const) : ("PENDING" as const),
    return_date: isFinalReturn ? latestEvent?.report_date : undefined,
  }
}

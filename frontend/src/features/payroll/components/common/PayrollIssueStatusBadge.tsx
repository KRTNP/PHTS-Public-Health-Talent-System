"use client"

import { IssueStatusBadge } from "@/components/common"

export function PayrollIssueStatusBadge({
  checkCount,
  blockerCount,
  warningCount,
}: {
  checkCount: number
  blockerCount: number
  warningCount: number
}) {
  return (
    <IssueStatusBadge
      checkCount={checkCount}
      blockerCount={blockerCount}
      warningCount={warningCount}
    />
  )
}

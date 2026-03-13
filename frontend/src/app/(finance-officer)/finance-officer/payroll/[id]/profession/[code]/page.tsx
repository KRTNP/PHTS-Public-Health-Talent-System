"use client"

import { use } from "react"
import { PayrollDetailContent } from "@/features/payroll/components"

type PageParams = Promise<{ id: string; code: string }>

export default function FinanceOfficerPayrollProfessionPage({ params }: { params: PageParams }) {
  const { id, code } = use(params)

  return (
    <PayrollDetailContent
      periodId={id}
      selectedProfession={code}
      basePath={`/finance-officer/payroll/${id}`}
      compactView
      showSelector={false}
      showSummary
      allowApprovalActions={false}
    />
  )
}

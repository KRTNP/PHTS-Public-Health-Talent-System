"use client"
export const dynamic = 'force-dynamic'

import { use } from "react"
import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PayrollDetailContent } from "@/features/payroll/components"
import { usePayrollReviewProgress } from "@/features/payroll/hooks"
import { usePeriods } from "@/features/payroll/hooks"
import type { PayPeriod } from "@/features/payroll/api"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CalendarDays, Users } from "lucide-react"

export default function PTSOfficerPayrollDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const periodsQuery = usePeriods()
  const { reviewedCodes, setProfessionReviewed } = usePayrollReviewProgress(id)
  const pageContainerClassName = "mx-auto w-full max-w-[1600px] px-4 md:px-6 lg:px-8"

  const periods = useMemo(() => {
    const rows = (periodsQuery.data ?? []) as PayPeriod[]
    return [...rows]
      .sort((a, b) => {
        const yearDiff = (b.period_year ?? 0) - (a.period_year ?? 0)
        if (yearDiff !== 0) return yearDiff
        return (b.period_month ?? 0) - (a.period_month ?? 0)
      })
      .map((period) => ({
        id: String(period.period_id),
        label: `${period.period_month}/${period.period_year > 2400 ? period.period_year : (period.period_year ?? 0) + 543}`,
      }))
  }, [periodsQuery.data])

  return (
    <div className="space-y-6 pb-10">
      <div className="pt-8">
        <div className={`${pageContainerClassName} flex flex-col gap-3 md:flex-row md:items-center md:justify-between`}>
          <div className="w-full md:w-[320px]">
            <Select
              value={id}
              onValueChange={(value) => {
                if (value !== id) router.push(`/pts-officer/payroll/${value}`)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกงวดที่ต้องการดูรายละเอียด" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    รอบ {period.label} (#{period.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <Button asChild variant="outline" className="w-full md:w-auto">
              <Link href={`/pts-officer/payroll/${id}/leaves`}>
                <CalendarDays className="mr-2 h-4 w-4" />
                ดูวันลาตามงวดนี้
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full md:w-auto">
              <Link href="/pts-officer/allowance-list">
                <Users className="mr-2 h-4 w-4" />
                เข้าหน้ารายชื่อผู้มีสิทธิ
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <PayrollDetailContent
        periodId={id}
        selectedProfession="all"
        basePath={`/pts-officer/payroll/${id}`}
        backHref="/pts-officer/payroll"
        showSelector
        showSummary={false}
        showTable={false}
        allowApprovalActions={false}
        reviewedProfessionCodes={reviewedCodes}
        onSetProfessionReviewed={setProfessionReviewed}
      />
    </div>
  )
}

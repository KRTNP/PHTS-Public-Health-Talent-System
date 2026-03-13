"use client"

import type { ReactNode } from "react"
import { SummaryMetricCard } from "@/components/common"
import type { LucideIcon } from "lucide-react"

export function PayrollSummaryCard({
  icon: Icon,
  title,
  value,
  iconClassName,
  iconBgClassName,
}: {
  icon: LucideIcon
  title: string
  value: ReactNode
  iconClassName: string
  iconBgClassName: string
}) {
  return (
    <SummaryMetricCard
      icon={Icon}
      title={title}
      value={value}
      iconClassName={iconClassName}
      iconBgClassName={iconBgClassName}
      layout="horizontal"
      iconPlacement="edge"
    />
  )
}

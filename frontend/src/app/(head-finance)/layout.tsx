import React from "react"
import { HeadFinanceSidebar } from "@/features/navigation/components"
import { requireRoleAccess } from "@/shared/auth/server-guard"

export default async function HeadFinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleAccess("HEAD_FINANCE")

  return (
    <div className="role-theme-head-finance min-h-screen bg-background">
      <HeadFinanceSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}

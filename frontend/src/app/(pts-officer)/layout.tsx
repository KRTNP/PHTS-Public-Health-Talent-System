import React from "react"
import { PtsOfficerSidebar } from "@/features/navigation/components"
import { requireRoleAccess } from "@/shared/auth/server-guard"

export const dynamic = 'force-dynamic'

export default async function PTSOfficerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleAccess("PTS_OFFICER")

  return (
    <div className="role-theme-pts-officer min-h-screen bg-background">
      <PtsOfficerSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}

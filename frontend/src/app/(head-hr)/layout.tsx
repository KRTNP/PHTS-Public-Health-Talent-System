import React from "react"
import { HeadHRSidebar } from "@/features/navigation/components"
import { requireRoleAccess } from "@/shared/auth/server-guard"

export default async function HeadHRLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleAccess("HEAD_HR")

  return (
    <div className="role-theme-head-hr min-h-screen bg-background">
      <HeadHRSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}

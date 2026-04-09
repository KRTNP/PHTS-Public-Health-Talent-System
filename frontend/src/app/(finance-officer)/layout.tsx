import { FinanceOfficerSidebar } from "@/features/navigation/components"
import { requireRoleAccess } from "@/shared/auth/server-guard"
export const dynamic = 'force-dynamic'


export default async function FinanceOfficerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleAccess("FINANCE_OFFICER")

  return (
    <div className="role-theme-finance-officer min-h-screen bg-background">
      <FinanceOfficerSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}

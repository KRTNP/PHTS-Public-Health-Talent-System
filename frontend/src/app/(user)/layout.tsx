import { UserSidebar } from "@/features/navigation/components"
import { requireRoleAccess } from "@/shared/auth/server-guard"

export const dynamic = 'force-dynamic'

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleAccess("USER")

  return (
    <div className="role-theme-user min-h-screen bg-background">
      <UserSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}

import { AdminSidebar } from "@/features/navigation/components"
import { requireRoleAccess } from "@/shared/auth/server-guard"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleAccess("ADMIN")

  return (
    <div className="role-theme-admin min-h-screen bg-background">
      <AdminSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}

import { DirectorSidebar } from "@/features/navigation/components"
import { requireRoleAccess } from "@/shared/auth/server-guard"

export default async function DirectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleAccess("DIRECTOR")

  return (
    <div className="role-theme-director min-h-screen bg-background">
      <DirectorSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}

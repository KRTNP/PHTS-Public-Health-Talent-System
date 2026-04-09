import React from "react";
import { HeadScopeUnifiedSidebar } from "@/features/navigation/components";
import { requireRoleAccess } from "@/shared/auth/server-guard";

export default async function HeadScopeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireRoleAccess("HEAD_SCOPE");

  return (
    <div className="role-theme-head-scope min-h-screen bg-background">
      <HeadScopeUnifiedSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}

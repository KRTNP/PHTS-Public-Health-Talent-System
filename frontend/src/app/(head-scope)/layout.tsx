import React from "react";
import { HeadScopeUnifiedSidebar } from "@/features/navigation/components";

export default function HeadScopeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="role-theme-head-scope min-h-screen bg-background">
      <HeadScopeUnifiedSidebar />
      <main className="ml-64 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}

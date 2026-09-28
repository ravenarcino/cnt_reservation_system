"use client";

import { useState } from "react";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar role="USER" />
        <main className="min-w-0 flex-1">
          <AppTopbar />
          <div className="p-6">{children}</div>
        </main>
      </SidebarProvider>
    </QueryClientProvider>
  );
}
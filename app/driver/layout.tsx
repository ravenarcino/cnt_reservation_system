"use client";

import { useState } from "react";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar role="DRIVER" />
        <main className="min-w-0 flex-1">
          <AppTopbar />
          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </SidebarProvider>
    </QueryClientProvider>
  );
}

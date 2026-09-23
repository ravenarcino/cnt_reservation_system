"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

// Top bar above every signed-in page: sidebar toggle and a breadcrumb built
// from the URL, e.g. "Super Admin / Driver Management".

const LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  it_admin: "IT Admin",
  hall_admin: "Hall Admin",
  ob_admin: "OB Admin",
  driver: "Driver",
  user: "User",
  "ob-reservation": "OB Reservation",
  "ob-calendar-management": "OB Calendar",
  "hall-reservation": "Hall Reservation",
  dayoff: "Day Off",
  dashboard: "Dashboard",
};

function label(segment: string) {
  return (
    LABELS[segment] ??
    segment
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

export function AppTopbar() {
  const pathname = usePathname() ?? "";
  const parts = pathname.split("/").filter(Boolean);

  return (
    <header className="flex h-12 items-center gap-3 border-b border-border px-4">
      <SidebarTrigger className="-ml-1" />
      <span className="h-4 w-px bg-border" />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        {parts.map((p, i) => {
          const last = i === parts.length - 1;
          return (
            <span key={p + i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-muted-foreground/60">/</span>}
              {last ? (
                <span className="font-medium text-foreground">{label(p)}</span>
              ) : i === 0 ? (
                <a href={`/${p}/dashboard`} className="text-muted-foreground hover:text-foreground">
                  {label(p)}
                </a>
              ) : (
                <span className="text-muted-foreground">{label(p)}</span>
              )}
            </span>
          );
        })}
      </nav>
    </header>
  );
}

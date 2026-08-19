"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import Image from "next/image";

import {
  superAdminNav,
  adminNav,
  hallAdminNav,
  userNav,
} from "@/components/navigation";

export function AppSidebar({
  role,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  role: "USER" | "IT_ADMIN" | "HALL_ADMIN" | "SUPER_ADMIN";
}) {
  const pathname = usePathname();

  const nav =
role === "SUPER_ADMIN"
  ? superAdminNav
  : role === "IT_ADMIN"
  ? adminNav
  : role === "HALL_ADMIN"
  ? hallAdminNav
  : userNav;

  return (
    <Sidebar variant="inset" {...props}>
      {/* HEADER (KEEPED) */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="#">
                {/* <div className="flex aspect-square size-8 items-center justify-center rounded-lg overflow-hidden">
                  <Image
                    src="/logo-white.png"
                    alt="FixIT Logo"
                    width={32}
                    height={32}
                    className="object-cover"
                  />
                </div> */}

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold text- text-lg">CNT Reservation</span>
                  <span className="truncate text-xs">Reservation System</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* CONTENT */}
      <SidebarContent>
        <NavMain items={nav} />
      </SidebarContent>

      {/* FOOTER */}
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
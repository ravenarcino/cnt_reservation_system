"use client"

import { useState } from "react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ChevronRightIcon } from "lucide-react"
import { signOut } from "next-auth/react"
import { clearOfflineCache } from "@/components/pwa/pwa"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

// Section each menu entry is listed under, by title. Entries not listed here
// fall under the previous section.
const SECTION_OF: Record<string, string> = {
  Dashboard: "Overview",
  "My Trips": "Overview",
  Tickets: "Reservations",
  "Hall Reservation": "Reservations",
  "OB Reservation": "Reservations",
  Reservations: "Reservations",
  "Day Off": "Reservations",
  Users: "Management",
  Items: "Management",
  Halls: "Management",
  Vehicles: "Management",
  Drivers: "Management",
  Calendar: "Management",
  Reports: "Insights",
  Logs: "Insights",
  General: "Account",
  Logout: "Account",
}

// Solid crimson pill for the page you are on.
const ACTIVE =
  "data-[active=true]:bg-brand data-[active=true]:text-white data-[active=true]:font-medium data-[active=true]:hover:bg-brand-hover data-[active=true]:hover:text-white"

// Which pending count each menu entry shows as a badge.
const BADGE_OF: Record<string, (c: NavCounts) => number> = {
  Tickets: (c) => c.hall + c.ob,
  "Hall Reservation": (c) => c.hall,
  "OB Reservation": (c) => c.ob,
  Calendar: (c) => c.dayoff,
}

type NavCounts = { hall: number; ob: number; dayoff: number }

export function NavMain({
  items,
}: {
  items: {
    title: string
    url?: string
    icon: React.ReactNode
    isActive?: boolean
    isLogout?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const pathname = usePathname() ?? ""
  const [counts, setCounts] = useState<NavCounts>({ hall: 0, ob: 0, dayoff: 0 })

  // Refresh the badges on every page change.
  useEffect(() => {
    fetch("/api/nav-counts")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setCounts(c))
      .catch(() => {})
  }, [pathname])
  const isOn = (url?: string) => !!url && (pathname === url || pathname.startsWith(url + "/"))

  // Group entries by section in a fixed order, so a section never appears
  // twice (e.g. General and Logout both land under Account).
  const SECTION_ORDER = ["Overview", "Reservations", "Management", "Insights", "Account"]
  const sectionIndex = (title: string) => {
    const i = SECTION_ORDER.indexOf(SECTION_OF[title] ?? "")
    return i === -1 ? SECTION_ORDER.length : i
  }
  const orderedItems = items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => sectionIndex(a.item.title) - sectionIndex(b.item.title) || a.i - b.i)
    .map(({ item }) => item)

  // Label before the first entry of each section. Worked out up front (no
  // mutable state during render) so every label has a unique, stable key.
  const labelAt = orderedItems.map((item, i) => {
    const section = SECTION_OF[item.title]
    const prev = i > 0 ? SECTION_OF[orderedItems[i - 1].title] : undefined
    return section && section !== prev ? section : null
  })
  const sectionLabel = (i: number) =>
    labelAt[i] ? (
      <li
        key={`section-${labelAt[i]}`}
        className="px-2 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground first:pt-1 group-data-[collapsible=icon]:hidden"
      >
        {labelAt[i]}
      </li>
    ) : null

  return (
    <SidebarGroup>
      <SidebarMenu>
        {orderedItems.flatMap((item, index) => [sectionLabel(index), (() => {
          if (item.isLogout) {
            return (
              <AlertDialog key={item.title} open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                <AlertDialogTrigger asChild>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip={item.title}>
                      {item.icon}
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will end your current session. You will need to login again to access your account.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        (clearOfflineCache(), signOut({ callbackUrl: "/auth/login" }))
                      }}
                    >
                      Logout
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          }

          const active =
            isOn(item.url) || !!item.items?.some((sub) => isOn(sub.url))
          return (
            <Collapsible key={item.title} asChild defaultOpen={item.isActive || active}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={item.title} isActive={active} className={ACTIVE}>
                  <a href={item.url}>
                    {item.icon}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
                {(BADGE_OF[item.title]?.(counts) ?? 0) > 0 && (
                  <SidebarMenuBadge
                    className={
                      (item.items?.length ? "right-7 " : "") +
                      (active ? "text-white" : "bg-brand-soft text-brand rounded-full px-1.5")
                    }
                  >
                    {BADGE_OF[item.title](counts)}
                  </SidebarMenuBadge>
                )}
                {item.items?.length ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction className="data-[state=open]:rotate-90">
                        <ChevronRightIcon />
                        <span className="sr-only">Toggle</span>
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items?.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isOn(subItem.url)}
                              className="data-[active=true]:text-brand data-[active=true]:font-medium"
                            >
                              <a href={subItem.url}>
                                <span>{subItem.title}</span>
                              </a>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : null}
              </SidebarMenuItem>
            </Collapsible>
          )
        })()])}
      </SidebarMenu>
    </SidebarGroup>
  )
}

import {
  LayoutDashboard,
  Ticket,
  Users,
  ClipboardList,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  User,
  FileText,
  Building,
  Calendar,
} from "lucide-react";

export const superAdminNav = [
  {
    title: "Dashboard",
    url: "/super_admin/dashboard",
    icon: <LayoutDashboard />,
  },
  {
    title: "Tickets",
    icon: <Ticket />,
    items: [
      {
        title: "Hall",
        url: "/super_admin/hall-reservation",
      },
      {
        title: "OB",
        url: "/super_admin/hall-reservation",
      },
    ],
  },
  {
    title: "Users",
    url: "/super_admin/user-management",
    icon: <Users />,
  },
  {
    title: "Items",
    url: "/super_admin/item-management",
    icon: <ClipboardList />,
  },
  {
    title: "Halls",
    url: "/super_admin/hall-management",
    icon: <Building />,
  },
  {
    title: "Calendar",
    url: "/super_admin/calendar-management",
    icon: <Calendar />,
  },
  {
    title: "Reports",
    url: "/super_admin/report",
    icon: <BarChart3 />,
  },
  {
    title: "General",
    url: "/super_admin/general",
    icon: <Settings />,
  },
  {
    title: "Logs",
    url: "/super_admin/logs",
    icon: <FileText />,
  },
  {
    title: "Logout",
    url: "/auth/login",
    icon: <LogOut />,
    isLogout: true,
  },
];

export const adminNav = [
  {
    title: "Dashboard",
    url: "/admin/dashboard",
    icon: <LayoutDashboard />,
  },
  {
    title: "Tickets",
    url: "/admin/tickets",
    icon: <Ticket />,
  },
  {
    title: "Reports",
    url: "/admin/report",
    icon: <BarChart3 />,
  },
  {
    title: "General",
    url: "/admin/general",
    icon: <Settings />,
  },
  {
    title: "Logs",
    url: "/user/logs",
    icon: <FileText />,
  },
  {
    title: "Logout",
    url: "/auth/login",
    icon: <LogOut />,
    isLogout: true,
  },
];

export const hallAdminNav = [
  {
    title: "Dashboard",
    url: "/hall_admin/dashboard",
    icon: <LayoutDashboard />,
  },
  {
    title: "Hall Reservation",
    url: "/hall_admin/hall-reservation",
    icon: <Ticket />,
  },
  {
    title: "Halls",
    url: "/hall_admin/hall-management",
    icon: <Building />,
  },
  {
    title: "Calendar",
    url: "/hall_admin/calendar-management",
    icon: <Calendar />,
  },
  {
    title: "Reports",
    url: "/hall_admin/report",
    icon: <BarChart3 />,
  },
  {
    title: "General",
    url: "/hall_admin/general",
    icon: <Settings />,
  },
  {
    title: "Logs",
    url: "/hall_admin/logs",
    icon: <FileText />,
  },
  {
    title: "Logout",
    url: "/auth/login",
    icon: <LogOut />,
    isLogout: true,
  },
];

export const userNav = [
  {
    title: "Dashboard",
    url: "/user/dashboard", // or "/user/dashboard" if that's your route
    icon: <LayoutDashboard />,
  },
  {
    title: "Reservations",
    url: "/user/reservation", // or "/user/reservations"
    icon: <Ticket />,
  },
  {
    title: "General",
    url: "/user/general", // or "/user/general"
    icon: <Settings />,
  },
  {
    title: "Logs",
    url: "/user/logs",
    icon: <FileText />,
  },
  {
    title: "Logout",
    url: "/auth/login",
    icon: <LogOut />,
    isLogout: true,
  },
];

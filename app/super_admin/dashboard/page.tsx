"use client";

import {
  ACTION_COLORS,
  ChartCard,
  DonutChart,
  HBarChart,
  SectionHeading,
  StatGroup,
  STATUS_COLORS,
  VBarChart,
} from "@/components/dashboard/charts";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  OnTheRoad,
  PendingApprovals,
  RecentReservations,
  RecentActivity,
  TodaySchedule,
  UpcomingNonWorking,
} from "@/components/dashboard/admin-tables";
import { format } from "date-fns";
import {
  Ticket,
  Clock,
  Users,
  Building,
  ClipboardList,
  CalendarX,
  Activity,
  Plane,
  Car,
  IdCard,
  CalendarCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ObAnalytics, useObStats, type ObTripRow } from "@/components/ob/ob-analytics";

type Reservation = {
  createdAt?: string;
  reservation_id: string;
  status: string;
  date_appointment: string;
  purpose: string;
  hall?: { hall_id: string; hall_name: string }[];
};

type Log = {
  log_id: string;
  event_type: string;
  createdAt: string;
};

export default function SuperAdminDashboard() {
  const { data: session } = useSession();
  const { data: reportData, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["adminDashboardReport"],
    queryFn: async () => {
      const res = await fetch(`/api/reports`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: usersData } = useQuery({
    queryKey: ["adminDashboardUsers"],
    queryFn: async () => {
      const res = await fetch(`/api/users/user?limit=1`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: hallsData } = useQuery({
    queryKey: ["adminDashboardHalls"],
    queryFn: async () => {
      const res = await fetch(`/api/halls/rooms/room?limit=1`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: itemsData } = useQuery({
    queryKey: ["adminDashboardItems"],
    queryFn: async () => {
      const res = await fetch(`/api/equipments/items/item?limit=1`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: vehiclesData } = useQuery({
    queryKey: ["adminDashboardVehicles"],
    queryFn: async () => {
      const res = await fetch(`/api/vehicles/vehicles/vehicle?limit=1`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { data: driversData } = useQuery({
    queryKey: ["adminDashboardDrivers"],
    queryFn: async () => {
      const res = await fetch(`/api/drivers/driver?limit=1`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const obTrips: ObTripRow[] = reportData?.data?.obReservations ?? [];
  const obStats = useObStats(obTrips);
  const obWeek = useMemo(() => {
    const week = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const filed = (from: number, to: number) =>
      obTrips.filter((t: any) => {
        const c = t.createdAt ? new Date(t.createdAt).getTime() : 0;
        return c >= from && c < to;
      }).length;
    return { thisWeek: filed(now - week, now + 1), lastWeek: filed(now - 2 * week, now - week) };
  }, [obTrips]);
  const reservations: Reservation[] = reportData?.data?.reservations ?? [];
  const logs: Log[] = reportData?.data?.logs ?? [];
  const nonWorkingDays = reportData?.data?.nonWorkingDays ?? [];

  const totalUsers = usersData?.total ?? 0;
  const totalHalls = hallsData?.total ?? 0;
  const totalItems = itemsData?.total ?? 0;

  const kpis = useMemo(() => {
    const total = reservations.length;
    const pending = reservations.filter(
      (r) => r.status === "PENDING" || r.status === "FOR_APPROVAL",
    ).length;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const today = reservations.filter(
      (r) => format(new Date(r.date_appointment), "yyyy-MM-dd") === todayStr,
    ).length;
    // Filed in the last 7 days, for the "+N this week" hint.
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = reservations.filter(
      (r) => r.createdAt && new Date(r.createdAt).getTime() >= weekAgo,
    ).length;
    const twoWeeksAgo = weekAgo - 7 * 24 * 60 * 60 * 1000;
    const lastWeek = reservations.filter((r) => {
      const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      return t >= twoWeeksAgo && t < weekAgo;
    }).length;
    return { total, pending, today, thisWeek, lastWeek };
  }, [reservations]);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        value,
        color: STATUS_COLORS[label] ?? "#2563eb",
      }))
      .sort((a, b) => b.value - a.value);
  }, [reservations]);

  const byMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations.forEach((r) => {
      const key = format(new Date(r.date_appointment), "MMM yyyy");
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        value,
        sort: new Date(label).getTime(),
      }))
      .sort((a, b) => a.sort - b.sort)
      .slice(-12)
      .map(({ label, value }) => ({ label, value }));
  }, [reservations]);

  const topHalls = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations.forEach((r) => {
      (r.hall ?? []).forEach((h) => {
        counts[h.hall_name] = (counts[h.hall_name] ?? 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value, color: "#0f766e" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [reservations]);

  const byAction = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((l) => {
      const key = l.event_type || "OTHER";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({
        label,
        value,
        color: ACTION_COLORS[label] ?? "#2563eb",
      }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

  return (
    <div className="h-full flex flex-col gap-5">
      <div>
        <h1 className="page-title">
          {(() => {
            const h = new Date().getHours();
            const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
            const first = session?.user?.name?.split(" ")[0];
            return first ? `${part}, ${first}` : part;
          })()}
        </h1>
        <p className="text-sm text-muted-foreground text-wrap">
          Here&apos;s what&apos;s happening across halls and OB trips
          {dataUpdatedAt ? ` · Updated ${format(new Date(dataUpdatedAt), "h:mm a")}` : ""}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
          <Spinner />
          <span>Loading dashboard...</span>
        </div>
      ) : (
        <>
          <SectionHeading title="Hall reservations" caption="Bookings of halls and meeting rooms" />
          <StatGroup
            title="Overview"
            stats={[
              { label: "Total reservations", value: kpis.total, delta: kpis.thisWeek - kpis.lastWeek, hint: `${kpis.thisWeek} filed this week`, icon: <Ticket />, href: "/super_admin/hall-reservation" },
              { label: "Pending approval", value: kpis.pending, hint: kpis.pending > 0 ? "Needs review" : "All caught up", icon: <Clock />, href: "/super_admin/hall-reservation" },
              { label: "Approved", value: reservations.filter((r) => r.status === "APPROVED").length, icon: <CalendarCheck />, href: "/super_admin/hall-reservation" },
              { label: "Today", value: kpis.today, hint: format(new Date(), "EEE, MMM d"), icon: <Ticket />, href: "/super_admin/hall-reservation" },
            ]}
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="By status" subtitle="All hall reservations">
              <DonutChart data={byStatus} emptyLabel="No reservations" />
            </ChartCard>
            <ChartCard title="Over time" subtitle="Reservations per month" className="lg:col-span-2">
              <VBarChart data={byMonth} emptyLabel="No reservations" />
            </ChartCard>
            <ChartCard title="Top halls" subtitle="Most booked, excluding cancelled" className="lg:col-span-3">
              <HBarChart data={topHalls} emptyLabel="No hall usage" />
            </ChartCard>
          </div>

          <SectionHeading title="OB trips" caption="Official business vehicle trips" />
          <StatGroup
            title="Overview"
            stats={[
              { label: "Total OB trips", value: obStats.total, delta: obWeek.thisWeek - obWeek.lastWeek, hint: `${obWeek.thisWeek} filed this week · ${obStats.upcoming} upcoming`, icon: <Plane />, href: "/super_admin/ob-reservation" },
              { label: "Pending", value: obStats.pending, hint: obStats.pending > 0 ? "Needs review" : "All caught up", icon: <Clock />, href: "/super_admin/ob-reservation" },
              { label: "Today", value: obStats.today, hint: format(new Date(), "EEE, MMM d"), icon: <CalendarCheck />, href: "/super_admin/ob-reservation" },
              { label: "Vehicles", value: vehiclesData?.total ?? 0, icon: <Car />, href: "/super_admin/vehicle-management" },
              { label: "Drivers", value: driversData?.total ?? 0, icon: <IdCard />, href: "/super_admin/driver-management" },
            ]}
          />
          <ObAnalytics
            trips={obTrips}
            vehiclesTotal={vehiclesData?.total ?? 0}
            driversTotal={driversData?.total ?? 0}
            basePath="/super_admin"
            showStats={false}
            showOverTime={false}
            showDestinations={false}
          />

          <SectionHeading title="Needs attention" caption="Pending requests and today's bookings" />
          <PendingApprovals
            halls={reportData?.data?.reservations ?? []}
            trips={obTrips as any}
            hallHref="/super_admin/hall-reservation"
            obHref="/super_admin/ob-reservation"
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <TodaySchedule halls={reportData?.data?.reservations ?? []} trips={obTrips as any} />
            <OnTheRoad trips={obTrips as any} href="/super_admin/vehicle-management" />
          </div>

          <SectionHeading title="System" caption="Accounts, resources and activity" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <StatGroup
              title="Resources"
              stats={[
                { label: "Users", value: totalUsers, icon: <Users />, href: "/super_admin/user-management" },
                { label: "Halls", value: totalHalls, icon: <Building />, href: "/super_admin/hall-management" },
                { label: "Equipment", value: totalItems, icon: <ClipboardList />, href: "/super_admin/item-management" },
                { label: "Non-working days", value: nonWorkingDays.length, icon: <CalendarX />, href: "/super_admin/calendar-management" },
                { label: "Activity logs", value: logs.length, icon: <Activity />, href: "/super_admin/logs" },
              ]}
            />
            <ChartCard title="Activity by action" subtitle="From the activity log">
              <DonutChart data={byAction} emptyLabel="No activity" />
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <RecentActivity logs={reportData?.data?.logs ?? []} href="/super_admin/logs" />
            <UpcomingNonWorking days={nonWorkingDays} href="/super_admin/calendar-management" />
          </div>

          <SectionHeading title="Recent reservations" caption="Newest hall and OB bookings" />
          <RecentReservations
            halls={reportData?.data?.reservations ?? []}
            trips={obTrips as any}
            href="/super_admin/hall-reservation"
          />
        </>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, Building, CalendarCheck, CalendarX, Clock, Ticket } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Greeting } from "@/components/dashboard/greeting";
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
import {
  PendingApprovals,
  RecentActivity,
  RecentReservations,
  TodaySchedule,
  UpcomingNonWorking,
} from "@/components/dashboard/admin-tables";

type Reservation = {
  reservation_id: string;
  status: string;
  purpose: string;
  date_appointment: string;
  time_from: string;
  time_to: string;
  createdAt?: string;
  hall?: { hall_id: string; hall_name: string }[];
  hall_user?: { name: string; department?: string } | null;
};

type Log = {
  log_id: string;
  event: string;
  event_type: string;
  createdAt: string;
  reservation_type?: string | null;
  user_personal_info_log?: { name: string } | null;
};

type Nwd = { nwd_id: string; date: string; description: string; type: string; nwd_type?: string };

const BASE = "/hall_admin";
const WEEK = 7 * 24 * 60 * 60 * 1000;

// Hall admin home: the hall half of the super admin dashboard. The reports
// API pins this role to hall data, hall calendar and Hall/Calendar logs.
export default function HallAdminDashboard() {
  // Fixed at mount so the week counts are stable across renders.
  const [now] = useState(() => Date.now());
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["hallAdminDashboard"],
    queryFn: async () => {
      const res = await fetch("/api/reports?scope=hall");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json.data as { reservations: Reservation[]; logs: Log[]; nonWorkingDays: Nwd[] };
    },
  });

  const { data: hallsData } = useQuery({
    queryKey: ["hallAdminDashboardHalls"],
    queryFn: async () => {
      const res = await fetch("/api/halls/rooms/room?limit=1");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const reservations = useMemo(() => data?.reservations ?? [], [data]);
  const logs = useMemo(() => data?.logs ?? [], [data]);
  const nonWorkingDays = useMemo(() => data?.nonWorkingDays ?? [], [data]);

  const kpis = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const filed = (from: number, to: number) =>
      reservations.filter((r) => {
        const c = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        return c >= from && c < to;
      }).length;
    return {
      total: reservations.length,
      pending: reservations.filter((r) => ["PENDING", "FOR_APPROVAL", "FOR_REVIEW"].includes(r.status)).length,
      approved: reservations.filter((r) => r.status === "APPROVED").length,
      today: reservations.filter(
        (r) =>
          format(new Date(r.date_appointment), "yyyy-MM-dd") === todayStr &&
          r.status !== "CANCELLED" &&
          r.status !== "DECLINED",
      ).length,
      thisWeek: filed(now - WEEK, now + 1),
      lastWeek: filed(now - 2 * WEEK, now - WEEK),
    };
  }, [reservations, now]);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations.forEach((r) => (counts[r.status] = (counts[r.status] ?? 0) + 1));
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? "#0ea5e9" }))
      .sort((a, b) => b.value - a.value);
  }, [reservations]);

  const byMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations.forEach((r) => {
      const k = format(new Date(r.date_appointment), "yyyy-MM");
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return Object.keys(counts)
      .sort()
      .slice(-12)
      .map((k) => ({ label: format(new Date(`${k}-01T00:00:00`), "MMM yy"), value: counts[k] }));
  }, [reservations]);

  const topHalls = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations
      .filter((r) => r.status !== "CANCELLED" && r.status !== "DECLINED")
      .forEach((r) => (r.hall ?? []).forEach((h) => (counts[h.hall_name] = (counts[h.hall_name] ?? 0) + 1)));
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value, color: "#dc2626" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [reservations]);

  const byAction = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((l) => (counts[l.event_type || "OTHER"] = (counts[l.event_type || "OTHER"] ?? 0) + 1));
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value, color: ACTION_COLORS[label] ?? "#8b5cf6" }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

  return (
    <div className="h-full flex flex-col gap-5">
      <Greeting caption="Here's what's happening with hall reservations" updatedAt={dataUpdatedAt} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Spinner />
          <span>Loading dashboard...</span>
        </div>
      ) : (
        <>
          <SectionHeading title="Hall reservations" caption="Bookings of halls and meeting rooms" />
          <StatGroup
            title="Overview"
            stats={[
              {
                label: "Total reservations",
                value: kpis.total,
                delta: kpis.thisWeek - kpis.lastWeek,
                hint: `${kpis.thisWeek} filed this week`,
                icon: <Ticket />,
                href: `${BASE}/hall-reservation`,
              },
              {
                label: "Pending approval",
                value: kpis.pending,
                hint: kpis.pending > 0 ? "Needs review" : "All caught up",
                icon: <Clock />,
                href: `${BASE}/hall-reservation`,
              },
              { label: "Approved", value: kpis.approved, icon: <CalendarCheck />, href: `${BASE}/hall-reservation` },
              { label: "Today", value: kpis.today, hint: format(new Date(), "EEE, MMM d"), icon: <Ticket />, href: `${BASE}/hall-reservation` },
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

          <SectionHeading title="Needs attention" caption="Pending requests and today's bookings" />
          <PendingApprovals halls={reservations} trips={[]} hallHref={`${BASE}/hall-reservation`} obHref={`${BASE}/hall-reservation`} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <TodaySchedule halls={reservations} trips={[]} />
            <UpcomingNonWorking days={nonWorkingDays} href={`${BASE}/calendar-management`} />
          </div>

          <SectionHeading title="Activity" caption="Halls, calendar and what changed" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <StatGroup
              title="Resources"
              stats={[
                { label: "Halls", value: hallsData?.total ?? 0, icon: <Building />, href: `${BASE}/hall-management` },
                { label: "Non-working days", value: nonWorkingDays.length, icon: <CalendarX />, href: `${BASE}/calendar-management` },
                { label: "Activity logs", value: logs.length, icon: <Activity />, href: `${BASE}/logs` },
              ]}
            />
            <ChartCard title="Activity by action" subtitle="Hall and calendar logs">
              <DonutChart data={byAction} emptyLabel="No activity" />
            </ChartCard>
          </div>
          <RecentActivity logs={logs} href={`${BASE}/logs`} />

          <SectionHeading title="Recent reservations" caption="Newest hall bookings" />
          <RecentReservations halls={reservations} trips={[]} href={`${BASE}/hall-reservation`} />
        </>
      )}
    </div>
  );
}

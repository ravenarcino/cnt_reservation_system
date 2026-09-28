"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, CalendarCheck, CalendarOff, CalendarX, Car, Clock, IdCard, Plane } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Greeting } from "@/components/dashboard/greeting";
import { ACTION_COLORS, ChartCard, DonutChart, SectionHeading, StatGroup } from "@/components/dashboard/charts";
import {
  OnTheRoad,
  PendingApprovals,
  RecentActivity,
  RecentReservations,
  TodaySchedule,
  UpcomingNonWorking,
} from "@/components/dashboard/admin-tables";
import { ObAnalytics, useObStats, type ObTripRow } from "@/components/ob/ob-analytics";
import { DayOffRequests } from "@/components/ob/dayoff-requests";

type Trip = ObTripRow & { createdAt?: string };

type Log = {
  log_id: string;
  event: string;
  event_type: string;
  createdAt: string;
  reservation_type?: string | null;
  user_personal_info_log?: { name: string } | null;
};

type Nwd = { nwd_id: string; date: string; description: string; type: string; nwd_type?: string };

const BASE = "/ob_admin";
const WEEK = 7 * 24 * 60 * 60 * 1000;

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error);
  return json;
};

// OB admin home: the OB half of the super admin dashboard plus the drivers'
// day-off requests. The reports API pins this role to OB data, the OB
// calendar and OB/Calendar logs.
export default function ObAdminDashboard() {
  // Fixed at mount so the week counts are stable across renders.
  const [now] = useState(() => Date.now());
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["obAdminDashboard"],
    queryFn: async () =>
      (await fetchJson("/api/reports?scope=ob")).data as {
        obReservations: Trip[];
        logs: Log[];
        nonWorkingDays: Nwd[];
      },
  });
  const { data: vehiclesData } = useQuery({
    queryKey: ["obDashboardVehicles"],
    queryFn: () => fetchJson("/api/vehicles/vehicles/vehicle?limit=1"),
  });
  const { data: driversData } = useQuery({
    queryKey: ["obDashboardDrivers"],
    queryFn: () => fetchJson("/api/drivers/driver?limit=1"),
  });
  // Same key as the day-off table below, so approving one updates the count.
  const { data: dayOffData } = useQuery({
    queryKey: ["dayOffRequests", "PENDING"],
    queryFn: () => fetchJson("/api/dayoff?status=PENDING") as Promise<{ data: unknown[] }>,
  });

  const trips = useMemo(() => data?.obReservations ?? [], [data]);
  const logs = useMemo(() => data?.logs ?? [], [data]);
  const nonWorkingDays = useMemo(() => data?.nonWorkingDays ?? [], [data]);
  const stats = useObStats(trips);
  const pendingDayOffs = dayOffData?.data?.length ?? 0;

  const week = useMemo(() => {
    const filed = (from: number, to: number) =>
      trips.filter((t) => {
        const c = t.createdAt ? new Date(t.createdAt).getTime() : 0;
        return c >= from && c < to;
      }).length;
    return { thisWeek: filed(now - WEEK, now + 1), lastWeek: filed(now - 2 * WEEK, now - WEEK) };
  }, [trips, now]);

  const byAction = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach((l) => (counts[l.event_type || "OTHER"] = (counts[l.event_type || "OTHER"] ?? 0) + 1));
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value, color: ACTION_COLORS[label] ?? "#8b5cf6" }))
      .sort((a, b) => b.value - a.value);
  }, [logs]);

  return (
    <div className="h-full flex flex-col gap-5">
      <Greeting caption="Here's what's happening with OB trips, vehicles and drivers" updatedAt={dataUpdatedAt} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Spinner />
          <span>Loading dashboard...</span>
        </div>
      ) : (
        <>
          <SectionHeading title="OB trips" caption="Official business vehicle trips" />
          <StatGroup
            title="Overview"
            stats={[
              {
                label: "Total OB trips",
                value: stats.total,
                delta: week.thisWeek - week.lastWeek,
                hint: `${week.thisWeek} filed this week · ${stats.upcoming} upcoming`,
                icon: <Plane />,
                href: `${BASE}/ob-reservation`,
              },
              {
                label: "Pending",
                value: stats.pending,
                hint: stats.pending > 0 ? "Needs review" : "All caught up",
                icon: <Clock />,
                href: `${BASE}/ob-reservation`,
              },
              { label: "Today", value: stats.today, hint: format(new Date(), "EEE, MMM d"), icon: <CalendarCheck />, href: `${BASE}/ob-reservation` },
              {
                label: "Day-off requests",
                value: pendingDayOffs,
                hint: pendingDayOffs > 0 ? "Waiting for you" : "None pending",
                icon: <CalendarOff />,
                href: `${BASE}/calendar-management`,
              },
            ]}
          />
          <ObAnalytics trips={trips} basePath={BASE} showStats={false} />

          <SectionHeading title="Needs attention" caption="Pending trips, today's schedule and who is out" />
          <PendingApprovals halls={[]} trips={trips} hallHref={`${BASE}/ob-reservation`} obHref={`${BASE}/ob-reservation`} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <TodaySchedule halls={[]} trips={trips} />
            <OnTheRoad trips={trips} href={`${BASE}/vehicle-management`} />
          </div>

          <SectionHeading title="Driver day offs" caption="Approve or decline requests from drivers" />
          <DayOffRequests />

          <SectionHeading title="Activity" caption="Fleet, calendar and what changed" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
            <StatGroup
              title="Resources"
              stats={[
                { label: "Vehicles", value: vehiclesData?.total ?? 0, icon: <Car />, href: `${BASE}/vehicle-management` },
                { label: "Drivers", value: driversData?.total ?? 0, icon: <IdCard />, href: `${BASE}/driver-management` },
                { label: "Non-working days", value: nonWorkingDays.length, icon: <CalendarX />, href: `${BASE}/calendar-management` },
                { label: "Activity logs", value: logs.length, icon: <Activity />, href: `${BASE}/logs` },
              ]}
            />
            <ChartCard title="Activity by action" subtitle="OB and calendar logs">
              <DonutChart data={byAction} emptyLabel="No activity" />
            </ChartCard>
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
            <RecentActivity logs={logs} href={`${BASE}/logs`} />
            <UpcomingNonWorking days={nonWorkingDays} href={`${BASE}/calendar-management`} />
          </div>

          <SectionHeading title="Recent trips" caption="Newest OB bookings" />
          <RecentReservations halls={[]} trips={trips} href={`${BASE}/ob-reservation`} />
        </>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Car, CalendarCheck, Clock, IdCard, Plane } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartCard, DonutChart, HBarChart, STATUS_COLORS, VBarChart } from "@/components/dashboard/charts";

// OB (official business) analytics, shared by the super admin dashboard, the
// OB admin dashboard and the report pages. One implementation so every page
// counts the same way and looks the same. The chart components match the ones
// already used on the hall dashboards.

export type ObTripRow = {
  ob_id: string;
  status: string;
  destination: string;
  purpose: string;
  time_from: string;
  time_to: string;
  vehicle?: { vehicle_id: string; vehicle_name: string }[];
  drivers?: { driver_id: string; driver_name: string }[];
  ob_user?: { name: string } | null;
};


function countBy<T>(rows: T[], key: (r: T) => string | string[]) {
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    const k = key(r);
    (Array.isArray(k) ? k : [k]).forEach((one) => {
      counts[one] = (counts[one] ?? 0) + 1;
    });
  });
  return counts;
}

// Aggregations used by the charts and by CSV export on the report pages.
export function useObStats(trips: ObTripRow[]) {
  return useMemo(() => {
    const active = trips.filter(
      (t) => t.status !== "CANCELLED" && t.status !== "DECLINED",
    );

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const byStatus = Object.entries(countBy(trips, (t) => t.status))
      .map(([label, value]) => ({
        label,
        value,
        color: STATUS_COLORS[label] ?? "#0ea5e9",
      }))
      .sort((a, b) => b.value - a.value);

    // Chronological, keyed by month of departure.
    const monthCounts = countBy(trips, (t) =>
      format(new Date(t.time_from), "yyyy-MM"),
    );
    const byMonth = Object.keys(monthCounts)
      .sort()
      .map((key) => ({
        label: format(new Date(`${key}-01T00:00:00`), "MMM yyyy"),
        value: monthCounts[key],
      }));

    const topVehicles = Object.entries(
      countBy(active, (t) => (t.vehicle ?? []).map((v) => v.vehicle_name)),
    )
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topDestinations = Object.entries(
      countBy(active, (t) => t.destination.trim() || "—"),
    )
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return {
      total: trips.length,
      pending: trips.filter((t) => t.status === "PENDING").length,
      upcoming: active.filter((t) => new Date(t.time_from) > dayEnd).length,
      today: active.filter(
        (t) => new Date(t.time_from) <= dayEnd && new Date(t.time_to) >= dayStart,
      ).length,
      byStatus,
      byMonth,
      topVehicles,
      topDestinations,
    };
  }, [trips]);
}

export function ObAnalytics({
  trips,
  vehiclesTotal,
  driversTotal,
  basePath,
  showStats = true,
  showOverTime = true,
  showDestinations = true,
}: {
  trips: ObTripRow[];
  vehiclesTotal?: number;
  driversTotal?: number;
  // e.g. "/super_admin" or "/ob_admin" - where the stat cards link to.
  basePath?: string;
  showStats?: boolean;
  showOverTime?: boolean;
  showDestinations?: boolean;
}) {
  const stats = useObStats(trips);

  return (
    <div className="flex flex-col gap-4">
      {showStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard
            title="Total OB Trips"
            hint={`${stats.upcoming} upcoming`}
            value={stats.total}
            icon={<Plane className="h-4 w-4 text-muted-foreground" />}
            href={basePath && `${basePath}/ob-reservation`}
          />
          <StatCard
            title="Pending OB"
            hint={stats.pending > 0 ? "Needs review" : "All caught up"}
            value={stats.pending}
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            href={basePath && `${basePath}/ob-reservation`}
          />
          <StatCard
            title="Today's OB Trips"
            hint={format(new Date(), "EEE, MMM d")}
            value={stats.today}
            icon={<CalendarCheck className="h-4 w-4 text-muted-foreground" />}
            href={basePath && `${basePath}/ob-reservation`}
          />
          <StatCard
            title="Total Vehicles"
            value={vehiclesTotal ?? 0}
            icon={<Car className="h-4 w-4 text-muted-foreground" />}
            href={basePath && `${basePath}/vehicle-management`}
          />
          <StatCard
            title="Total Drivers"
            value={driversTotal ?? 0}
            icon={<IdCard className="h-4 w-4 text-muted-foreground" />}
            href={basePath && `${basePath}/driver-management`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="By status" subtitle="All OB trips">
          <DonutChart data={stats.byStatus} emptyLabel="No OB trips" />
        </ChartCard>

        {showOverTime && (
          <ChartCard title="Over time" subtitle="Trips per month">
            <VBarChart data={stats.byMonth} emptyLabel="No OB trips" />
          </ChartCard>
        )}

        <ChartCard title="Top vehicles" subtitle="Most used, excluding cancelled">
          <HBarChart data={stats.topVehicles} emptyLabel="No vehicle usage" />
        </ChartCard>

        {showDestinations && (
          <ChartCard title="Top destinations" subtitle="Most visited">
            <HBarChart data={stats.topDestinations} emptyLabel="No destinations" />
          </ChartCard>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces





function StatCard({
  title,
  hint,
  value,
  icon,
  href,
}: {
  title: string;
  hint?: string;
  value: number | string;
  icon: React.ReactNode;
  href?: string;
}) {
  const router = useRouter();
  const clickable = !!href;

  return (
    <Card
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => router.push(href!) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(href!);
              }
            }
          : undefined
      }
      className={
        "shadow-sm h-full" +
        (clickable
          ? " cursor-pointer transition-all hover:shadow-md hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          : "")
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

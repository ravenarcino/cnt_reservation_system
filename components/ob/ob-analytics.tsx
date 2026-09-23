"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Car, CalendarCheck, Clock, IdCard, Plane } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "#16a34a",
  PENDING: "#ca8a04",
  FOR_APPROVAL: "#ca8a04",
  FOR_REVIEW: "#ea580c",
  DECLINED: "#dc2626",
  CANCELLED: "#6b7280",
  DONE: "#2563eb",
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
        color: STATUS_COLORS[label] ?? "#2563eb",
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
      .map(([label, value]) => ({ label, value, color: "#2563eb" }))
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
        <ChartCard title="OB Trips by Status">
          <DonutChart data={stats.byStatus} emptyLabel="No OB trips" />
        </ChartCard>

        {showOverTime && (
          <ChartCard title="OB Trips Over Time">
            <VBarChart data={stats.byMonth} emptyLabel="No OB trips" />
          </ChartCard>
        )}

        <ChartCard title="Top Vehicles">
          <HBarChart data={stats.topVehicles} emptyLabel="No vehicle usage" />
        </ChartCard>

        {showDestinations && (
          <ChartCard title="Top Destinations">
            <HBarChart data={stats.topDestinations} emptyLabel="No destinations" />
          </ChartCard>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DonutChart({
  data,
  emptyLabel = "No data",
}: {
  data: { label: string; value: number; color?: string }[];
  emptyLabel?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (data.length === 0 || total === 0) {
    return <p className="text-sm text-muted-foreground py-6">{emptyLabel}</p>;
  }

  const palette = ["#16a34a", "#2563eb", "#ca8a04", "#dc2626", "#7c3aed", "#0891b2", "#ea580c", "#6b7280"];

  let acc = 0;
  const segments = data
    .map((d, i) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      return `${d.color ?? palette[i % palette.length]} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative h-40 w-40 shrink-0">
        <div
          className="h-full w-full rounded-full"
          style={{ background: `conic-gradient(${segments})` }}
        />
        <div className="absolute inset-0 m-auto h-20 w-20 rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
          <span className="text-lg font-bold">{total}</span>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 w-full">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-3 w-3 rounded-sm shrink-0"
              style={{ backgroundColor: d.color ?? palette[i % palette.length] }}
            />
            <span className="font-medium">{d.label}</span>
            <span className="text-muted-foreground ml-auto">
              {d.value} ({Math.round((d.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HBarChart({
  data,
  emptyLabel = "No data",
}: {
  data: { label: string; value: number; color?: string }[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-6">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{d.label}</span>
            <span className="text-muted-foreground">{d.value}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color ?? "#16a34a",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function VBarChart({
  data,
  emptyLabel = "No data",
}: {
  data: { label: string; value: number }[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-6">{emptyLabel}</p>;
  }
  return (
    <div className="flex items-end gap-2 h-48">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] text-muted-foreground">{d.value}</span>
          <div
            className="w-full rounded-t bg-brand transition-all"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: "2px" }}
          />
          <span className="text-[10px] text-muted-foreground truncate w-full text-center">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

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

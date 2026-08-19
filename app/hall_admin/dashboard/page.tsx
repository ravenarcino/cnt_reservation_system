"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Ticket,
  Clock,
  Users,
  Building,
  ClipboardList,
  CalendarX,
  Activity,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

type Reservation = {
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

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "#16a34a",
  PENDING: "#ca8a04",
  FOR_APPROVAL: "#ca8a04",
  FOR_REVIEW: "#ea580c",
  DECLINED: "#dc2626",
  CANCELLED: "#6b7280",
  DONE: "#2563eb",
};

const ACTION_COLORS: Record<string, string> = {
  CREATED: "#16a34a",
  UPDATED: "#2563eb",
  DELETED: "#dc2626",
  CANCELLED: "#6b7280",
};

// ---- Dependency-free chart components ----

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

  const palette = [
    "#16a34a",
    "#2563eb",
    "#ca8a04",
    "#dc2626",
    "#7c3aed",
    "#0891b2",
    "#ea580c",
    "#6b7280",
  ];

  let acc = 0;
  const segments = data
    .map((d, i) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      const color = d.color ?? palette[i % palette.length];
      return `${color} ${start}deg ${end}deg`;
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
        {data.map((d, i) => {
          const pct = Math.round((d.value / total) * 100);
          const color = d.color ?? palette[i % palette.length];
          return (
            <div key={d.label} className="flex items-center gap-2 text-xs">
              <span
                className="h-3 w-3 rounded-sm shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium">{d.label}</span>
              <span className="text-muted-foreground ml-auto">
                {d.value} ({pct}%)
              </span>
            </div>
          );
        })}
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
        <div
          key={d.label}
          className="flex flex-1 flex-col items-center justify-end gap-1"
        >
          <span className="text-[10px] text-muted-foreground">{d.value}</span>
          <div
            className="w-full rounded-t bg-green-700 transition-all"
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
  value,
  icon,
  href,
}: {
  title: string;
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
        "shadow-sm" +
        (clickable
          ? " cursor-pointer transition-all hover:shadow-md hover:border-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
          : "")
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function SuperAdminDashboard() {
  const { data: reportData, isLoading } = useQuery({
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
    return { total, pending, today };
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
        <p className="text-lg font-semibold">Dashboard</p>
        <p className="text-sm text-muted-foreground text-wrap">
          System overview and key metrics
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
          <Spinner />
          <span>Loading dashboard...</span>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatCard
              title="Total Reservations"
              value={kpis.total}
              icon={<Ticket className="h-4 w-4 text-muted-foreground" />}
              href="/hall_admin/hall-reservation"
            />
            <StatCard
              title="Pending Approval"
              value={kpis.pending}
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
              href="/hall_admin/hall-reservation"
            />
            <StatCard
              title="Today's Reservations"
              value={kpis.today}
              icon={<Ticket className="h-4 w-4 text-muted-foreground" />}
              href="/hall_admin/hall-reservation"
            />
            <StatCard
              title="Total Users"
              value={totalUsers}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
              href="/hall_admin/user-management"
            />
            <StatCard
              title="Total Halls"
              value={totalHalls}
              icon={<Building className="h-4 w-4 text-muted-foreground" />}
              href="/hall_admin/hall-management"
            />
            <StatCard
              title="Total Equipment"
              value={totalItems}
              icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
              href="/hall_admin/item-management"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">
                  Reservations by Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={byStatus} emptyLabel="No reservations" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">
                  Reservations Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VBarChart data={byMonth} emptyLabel="No reservations" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">Top Halls</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarChart data={topHalls} emptyLabel="No hall usage" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Activity by Action
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={byAction} emptyLabel="No activity" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <StatCard
              title="Non-Working Days"
              value={nonWorkingDays.length}
              icon={<CalendarX className="h-4 w-4 text-muted-foreground" />}
              href="/hall_admin/calendar-management"
            />
            <StatCard
              title="Total Activity Logs"
              value={logs.length}
              icon={<Activity className="h-4 w-4 text-muted-foreground" />}
              href="/hall_admin/logs"
            />
            <StatCard
              title="Approved Reservations"
              value={
                reservations.filter((r) => r.status === "APPROVED").length
              }
              icon={<Ticket className="h-4 w-4 text-muted-foreground" />}
              href="/hall_admin/hall-reservation"
            />
          </div>
        </>
      )}
    </div>
  );
}

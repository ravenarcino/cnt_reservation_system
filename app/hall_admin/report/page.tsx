"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
} from "date-fns";
import {
  Ticket,
  CheckCircle2,
  Clock,
  XCircle,
  CalendarX,
  Activity,
  Download,
  Printer,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Reservation = {
  reservation_id: string;
  status: string;
  date_appointment: string;
  createdAt: string;
  purpose: string;
  hall?: { hall_id: string; hall_name: string }[];
  equipment?: { item_id: string; item_name: string }[];
  hall_user?: { name: string; department: string };
};

type Log = {
  log_id: string;
  event_type: string;
  event: string;
  reservation_type: string | null;
  createdAt: string;
};

type NoWorkDay = {
  nwd_id: string;
  date: string;
  description: string;
  type: string;
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

// ---- Small dependency-free chart components ----

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
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
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

export default function ReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["report", from, to],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(from && { from }),
        ...(to && { to }),
      });

      const res = await fetch(`/api/reports?${params}`);
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error);

      return json;
    },
  });

  const reservations: Reservation[] = data?.data?.reservations ?? [];
  const logs: Log[] = data?.data?.logs ?? [];
  const nonWorkingDays: NoWorkDay[] = data?.data?.nonWorkingDays ?? [];

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const total = reservations.length;
    const approved = reservations.filter((r) => r.status === "APPROVED").length;
    const pending = reservations.filter(
      (r) => r.status === "PENDING" || r.status === "FOR_APPROVAL",
    ).length;
    const rejected = reservations.filter(
      (r) => r.status === "DECLINED" || r.status === "CANCELLED",
    ).length;
    const done = reservations.filter((r) => r.status === "DONE").length;

    return { total, approved, pending, rejected, done };
  }, [reservations]);

  // ---- Reservations by status ----
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

  // ---- Reservations by month ----
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

  // ---- Top halls ----
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

  // ---- Top equipment ----
  const topEquipment = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations.forEach((r) => {
      (r.equipment ?? []).forEach((e) => {
        counts[e.item_name] = (counts[e.item_name] ?? 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value, color: "#7c3aed" }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [reservations]);

  // ---- Activity by action ----
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

  // ---- Non-working days by type ----
  const nwdByType = useMemo(() => {
    const custom = nonWorkingDays.filter((d) => d.type === "CUSTOM").length;
    const holiday = nonWorkingDays.filter((d) => d.type === "HOLIDAY").length;
    return [
      { label: "Custom", value: custom, color: "#6b7280" },
      { label: "Holiday", value: holiday, color: "#0891b2" },
    ].filter((d) => d.value > 0);
  }, [nonWorkingDays]);

  const rangeLabel =
    from || to
      ? `${from ? format(new Date(from), "PPP") : "start"} — ${
          to ? format(new Date(to), "PPP") : "today"
        }`
      : "All time";

  function applyPreset(preset: "month" | "year" | "all") {
    if (preset === "all") {
      setFrom("");
      setTo("");
      return;
    }
    const now = new Date();
    if (preset === "month") {
      setFrom(format(startOfMonth(now), "yyyy-MM-dd"));
      setTo(format(endOfMonth(now), "yyyy-MM-dd"));
    } else {
      setFrom(format(startOfYear(now), "yyyy-MM-dd"));
      setTo(format(endOfYear(now), "yyyy-MM-dd"));
    }
  }

  function exportCsv() {
    const lines: string[] = [];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

    lines.push(esc("CNT Reservation — Report"));
    lines.push(esc(`Range: ${rangeLabel}`));
    lines.push("");

    lines.push(esc("Summary"));
    lines.push([esc("Total Reservations"), esc(kpis.total)].join(","));
    lines.push([esc("Approved"), esc(kpis.approved)].join(","));
    lines.push([esc("Pending"), esc(kpis.pending)].join(","));
    lines.push([esc("Declined/Cancelled"), esc(kpis.rejected)].join(","));
    lines.push([esc("Done"), esc(kpis.done)].join(","));
    lines.push([esc("Total Activity Logs"), esc(logs.length)].join(","));
    lines.push(
      [esc("Non-Working Days"), esc(nonWorkingDays.length)].join(","),
    );
    lines.push("");

    lines.push(esc("Reservations by Status"));
    byStatus.forEach((d) =>
      lines.push([esc(d.label), esc(d.value)].join(",")),
    );
    lines.push("");

    lines.push(esc("Top Halls"));
    topHalls.forEach((d) => lines.push([esc(d.label), esc(d.value)].join(",")));
    lines.push("");

    lines.push(esc("Top Equipment"));
    topEquipment.forEach((d) =>
      lines.push([esc(d.label), esc(d.value)].join(",")),
    );
    lines.push("");

    lines.push(esc("Reservation Details"));
    lines.push(
      [
        esc("Reservation ID"),
        esc("Purpose"),
        esc("Reserved By"),
        esc("Department"),
        esc("Halls"),
        esc("Status"),
        esc("Date"),
      ].join(","),
    );
    reservations.forEach((r) =>
      lines.push(
        [
          esc(r.reservation_id),
          esc(r.purpose),
          esc(r.hall_user?.name ?? ""),
          esc(r.hall_user?.department ?? ""),
          esc((r.hall ?? []).map((h) => h.hall_name).join(" | ")),
          esc(r.status),
          esc(format(new Date(r.date_appointment), "yyyy-MM-dd")),
        ].join(","),
      ),
    );

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full flex flex-col gap-5">
      {/* Print rules: hide controls, keep report */}
      <style>{`@media print { .no-print { display: none !important; } }`}</style>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Reports</p>
          <p className="text-sm text-muted-foreground text-wrap">
            Overview of reservations, usage, activity and non-working days
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Showing: <span className="font-medium">{rangeLabel}</span>
          </p>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset("month")}
          >
            This Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset("year")}
          >
            This Year
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyPreset("all")}
          >
            All
          </Button>
        </div>
      </div>

      {/* Date range + export */}
      <div className="no-print flex flex-col lg:flex-row gap-3 lg:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full lg:w-44 rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full lg:w-44 rounded-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="flex gap-2 lg:ml-auto">
          <Button
            variant="outline"
            onClick={exportCsv}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            onClick={() => window.print()}
            className="gap-2 bg-green-800 text-white"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
          <Spinner />
          <span>Building report...</span>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard
              title="Total Reservations"
              value={kpis.total}
              icon={<Ticket className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Approved"
              value={kpis.approved}
              icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Pending"
              value={kpis.pending}
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Declined / Cancelled"
              value={kpis.rejected}
              icon={<XCircle className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Done"
              value={kpis.done}
              icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
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
                <CardTitle className="text-sm">Top Equipment</CardTitle>
              </CardHeader>
              <CardContent>
                <HBarChart data={topEquipment} emptyLabel="No equipment usage" />
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

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarX className="h-4 w-4" />
                  Non-Working Days by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={nwdByType} emptyLabel="No non-working days" />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
} from "date-fns";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Sheet as SheetIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/management/parts";
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
  ObAnalytics,
  useObStats,
  type ObTripRow,
} from "@/components/ob/ob-analytics";
import {
  exportReportCsv,
  exportReportPdf,
  exportReportXlsx,
  type ReportExport,
  type ReportTable,
} from "@/lib/report-export";

type Reservation = {
  reservation_id: string;
  status: string;
  date_appointment: string;
  time_from: string;
  time_to: string;
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
  changes?: string | null;
  reservation_type: string | null;
  createdAt: string;
  user_personal_info_log?: { name: string } | null;
};

type NoWorkDay = {
  nwd_id: string;
  date: string;
  description: string;
  type: string;
  nwd_type?: string;
};

type ReportData = {
  reservations: Reservation[];
  obReservations: ObTripRow[];
  logs: Log[];
  nonWorkingDays: NoWorkDay[];
};

const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const pretty = (s: string) =>
  s
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

type Preset = "month" | "last-month" | "quarter" | "year" | "all";

function presetRange(p: Preset): [string, string] {
  const now = new Date();
  switch (p) {
    case "month":
      return [ymd(startOfMonth(now)), ymd(endOfMonth(now))];
    case "last-month": {
      const m = subMonths(now, 1);
      return [ymd(startOfMonth(m)), ymd(endOfMonth(m))];
    }
    case "quarter":
      return [ymd(startOfQuarter(now)), ymd(endOfQuarter(now))];
    case "year":
      return [ymd(startOfYear(now)), ymd(endOfYear(now))];
    default:
      return ["", ""];
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

export type ReportScope = "all" | "hall" | "ob";

async function fetchReport(
  scope: ReportScope,
  from: string,
  to: string,
): Promise<ReportData> {
  const params = new URLSearchParams({
    scope,
    ...(from && { from }),
    ...(to && { to }),
  });
  const res = await fetch(`/api/reports?${params}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error);
  return json.data;
}

// Counts per key, sorted high to low.
function tally<T>(rows: T[], key: (r: T) => string | string[], limit = 8) {
  const counts: Record<string, number> = {};
  rows.forEach((r) => {
    const k = key(r);
    (Array.isArray(k) ? k : [k]).forEach((one) => {
      if (one) counts[one] = (counts[one] ?? 0) + 1;
    });
  });
  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

// Status counts shared by the hall and OB stat strips.
function statusCounts(rows: { status: string }[]) {
  const is = (...s: string[]) =>
    rows.filter((r) => s.includes(r.status)).length;
  return {
    total: rows.length,
    approved: is("APPROVED"),
    pending: is("PENDING", "FOR_APPROVAL", "FOR_REVIEW"),
    rejected: is("DECLINED", "CANCELLED"),
    done: is("DONE"),
  };
}

// The Reports page for every admin role. `scope` trims it to one module: the
// hall admin sees hall only, the OB admin OB only (the API enforces the same).
export function ReportView({ scope }: { scope: ReportScope }) {
  const showHall = scope !== "ob";
  const showOb = scope !== "hall";
  const { data: session } = useSession();
  const [[from, to], setRange] = useState<[string, string]>(
    presetRange("month"),
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["report", scope, from, to],
    queryFn: () => fetchReport(scope, from, to),
  });

  // The same number of days just before the range, for the +/- pills.
  const prev = useMemo(() => {
    if (!from || !to) return null;
    const days = differenceInCalendarDays(new Date(to), new Date(from)) + 1;
    const prevTo = addDays(new Date(from), -1);
    return [ymd(addDays(prevTo, -(days - 1))), ymd(prevTo)] as const;
  }, [from, to]);

  const { data: prevData } = useQuery({
    queryKey: ["report", scope, prev?.[0], prev?.[1]],
    queryFn: () => fetchReport(scope, prev![0], prev![1]),
    enabled: !!prev,
  });

  const reservations = useMemo(() => data?.reservations ?? [], [data]);
  const obTrips = useMemo(() => data?.obReservations ?? [], [data]);
  const logs = useMemo(() => data?.logs ?? [], [data]);
  const nonWorkingDays = useMemo(() => data?.nonWorkingDays ?? [], [data]);
  const obStats = useObStats(obTrips);

  const hall = statusCounts(reservations);
  const ob = statusCounts(obTrips);
  const hallPrev = prevData ? statusCounts(prevData.reservations) : null;
  const obPrev = prevData ? statusCounts(prevData.obReservations) : null;
  const delta = (now: number, before?: number) =>
    before === undefined ? undefined : now - before;

  const byStatus = useMemo(
    () =>
      tally(reservations, (r) => r.status, 20).map((d) => ({
        ...d,
        color: STATUS_COLORS[d.label] ?? "#0ea5e9",
      })),
    [reservations],
  );

  const byMonth = useMemo(() => {
    const counts: Record<string, number> = {};
    reservations.forEach((r) => {
      const k = format(new Date(r.date_appointment), "yyyy-MM");
      counts[k] = (counts[k] ?? 0) + 1;
    });
    return Object.keys(counts)
      .sort()
      .slice(-12)
      .map((k) => ({
        label: format(new Date(`${k}-01T00:00:00`), "MMM yy"),
        value: counts[k],
      }));
  }, [reservations]);

  const active = useMemo(
    () =>
      reservations.filter(
        (r) => r.status !== "CANCELLED" && r.status !== "DECLINED",
      ),
    [reservations],
  );
  const topHalls = useMemo(
    () =>
      tally(active, (r) => (r.hall ?? []).map((h) => h.hall_name)).map((d) => ({
        ...d,
        color: "#dc2626",
      })),
    [active],
  );
  const topEquipment = useMemo(
    () =>
      tally(active, (r) => (r.equipment ?? []).map((e) => e.item_name)).map(
        (d) => ({ ...d, color: "#0ea5e9" }),
      ),
    [active],
  );
  const byDepartment = useMemo(
    () =>
      tally(
        reservations,
        (r) => r.hall_user?.department || "No department",
      ).map((d) => ({ ...d, color: "#f59e0b" })),
    [reservations],
  );
  const byAction = useMemo(
    () =>
      tally(logs, (l) => l.event_type || "OTHER", 20).map((d) => ({
        ...d,
        color: ACTION_COLORS[d.label] ?? "#8b5cf6",
      })),
    [logs],
  );
  const topUsers = useMemo(
    () =>
      tally(logs, (l) => l.user_personal_info_log?.name ?? "Unknown").map(
        (d) => ({ ...d, color: "#8b5cf6" }),
      ),
    [logs],
  );
  const nwdByType = useMemo(
    () =>
      [
        {
          label: "Holiday",
          value: nonWorkingDays.filter((d) => d.type === "HOLIDAY").length,
          color: "#dc2626",
        },
        {
          label: "Custom",
          value: nonWorkingDays.filter((d) => d.type === "CUSTOM").length,
          color: "#a3a3a3",
        },
      ].filter((d) => d.value > 0),
    [nonWorkingDays],
  );

  // Approved or done, out of every request that got a decision.
  const decided = hall.approved + hall.done + ob.approved + ob.done; // the other list is empty when scoped
  const declined =
    reservations.filter((r) => r.status === "DECLINED").length +
    obTrips.filter((t) => t.status === "DECLINED").length;
  const approvalRate =
    decided + declined
      ? Math.round((decided / (decided + declined)) * 100)
      : null;

  const activePreset = PRESETS.find((p) => {
    const [f, t] = presetRange(p.key);
    return f === from && t === to;
  })?.key;

  const rangeLabel =
    from || to
      ? `${from ? format(new Date(from), "MMM d, yyyy") : "Start"} – ${to ? format(new Date(to), "MMM d, yyyy") : "Today"}`
      : "All time";
  const prevLabel = prev
    ? `vs ${format(new Date(prev[0]), "MMM d")} – ${format(new Date(prev[1]), "MMM d, yyyy")}`
    : undefined;

  // ------------------------------------------------------------ exports

  const [exporting, setExporting] = useState<string | null>(null);

  function buildExport(): ReportExport {
    const d = (s: string) => format(new Date(s), "yyyy-MM-dd");
    const t = (s: string) => format(new Date(s), "h:mm a");
    const two = (rows: { label: string; value: number }[]) =>
      rows.map((r) => [pretty(r.label), r.value]);
    const summaryRows: [string, number | string, number | string][] = [
      ["Total requests", hall.total, ob.total],
      ["Approved", hall.approved, ob.approved],
      ["Pending / in review", hall.pending, ob.pending],
      ["Declined / cancelled", hall.rejected, ob.rejected],
      ["Done", hall.done, ob.done],
    ];
    const extra: (string | number)[][] = [
      ["Approval rate", approvalRate === null ? "—" : `${approvalRate}%`],
      ["Activity log entries", logs.length],
      ["Non-working days", nonWorkingDays.length],
    ];
    const pad = (row: (string | number)[]) =>
      scope === "all" ? [...row, ""] : row;

    const tables: ReportTable[] = [];
    if (showHall)
      tables.push({
        title: "Hall requests by status",
        head: ["Status", "Count"],
        body: two(byStatus),
        breakdown: true,
      });
    if (showOb)
      tables.push({
        title: "OB trips by status",
        head: ["Status", "Count"],
        body: two(obStats.byStatus),
        breakdown: true,
      });
    if (showHall) {
      tables.push(
        {
          title: "Top halls",
          head: ["Hall", "Bookings"],
          body: two(topHalls),
          breakdown: true,
        },
        {
          title: "Top equipment",
          head: ["Item", "Bookings"],
          body: two(topEquipment),
          breakdown: true,
        },
        {
          title: "Requests by department",
          head: ["Department", "Requests"],
          body: two(byDepartment),
          breakdown: true,
        },
      );
    }
    if (showOb) {
      tables.push(
        {
          title: "Top vehicles",
          head: ["Vehicle", "Trips"],
          body: two(obStats.topVehicles),
          breakdown: true,
        },
        {
          title: "Top destinations",
          head: ["Destination", "Trips"],
          body: two(obStats.topDestinations),
          breakdown: true,
        },
      );
    }
    tables.push({
      title: "Activity by action",
      head: ["Action", "Entries"],
      body: two(byAction),
      breakdown: true,
    });
    if (showHall) {
      tables.push({
        title: "Hall reservations",
        head: [
          "ID",
          "Date",
          "Time",
          "Purpose",
          "Hall",
          "Requested by",
          "Department",
          "Status",
        ],
        body: reservations.map((r) => [
          r.reservation_id,
          d(r.date_appointment),
          `${t(r.time_from)} – ${t(r.time_to)}`,
          r.purpose,
          (r.hall ?? []).map((h) => h.hall_name).join(", "),
          r.hall_user?.name ?? "",
          r.hall_user?.department ?? "",
          pretty(r.status),
        ]),
      });
    }
    if (showOb) {
      tables.push({
        title: "OB trips",
        head: [
          "ID",
          "Departure",
          "Return",
          "Destination",
          "Purpose",
          "Requested by",
          "Vehicle",
          "Driver",
          "Status",
        ],
        body: obTrips.map((o) => [
          o.ob_id,
          format(new Date(o.time_from), "yyyy-MM-dd h:mm a"),
          format(new Date(o.time_to), "yyyy-MM-dd h:mm a"),
          o.destination,
          o.purpose,
          o.ob_user?.name ?? "",
          (o.vehicle ?? []).map((v) => v.vehicle_name).join(", "),
          (o.drivers ?? []).map((x) => x.driver_name).join(", "),
          pretty(o.status),
        ]),
      });
    }
    tables.push({
      title: "Non-working days",
      head: ["Date", "Description", "Type", "Calendar"],
      body: nonWorkingDays.map((n) => [
        d(n.date),
        n.description,
        pretty(n.type),
        n.nwd_type ?? "",
      ]),
    });

    return {
      rangeLabel: `${scope === "hall" ? "Hall · " : scope === "ob" ? "OB · " : ""}${rangeLabel}`,
      generatedBy: session?.user?.name,
      summaryHead:
        scope === "all"
          ? ["Metric", "Hall", "OB"]
          : ["Metric", scope === "hall" ? "Hall" : "OB"],
      summary: [
        ...summaryRows.map(([m, h, o]) =>
          scope === "all" ? [m, h, o] : [m, scope === "hall" ? h : o],
        ),
        ...extra.map(pad),
      ],
      tables,
    };
  }

  async function runExport(kind: "pdf" | "xlsx" | "csv") {
    setExporting(kind);
    try {
      const r = buildExport();
      if (kind === "pdf") await exportReportPdf(r);
      else if (kind === "xlsx") await exportReportXlsx(r);
      else exportReportCsv(r);
    } finally {
      setExporting(null);
    }
  }

  // ---------------------------------------------------------------- view

  return (
    <div className="h-full flex flex-col gap-5">
      <PageHeader
        title="Reports"
        subtitle={
          scope === "hall"
            ? "Hall reservations and activity for a date range"
            : scope === "ob"
              ? "OB trips and activity for a date range"
              : "Hall reservations, OB trips and activity for a date range"
        }
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={isLoading || !!exporting} className="gap-2">
              {exporting ? <Spinner /> : <Download className="h-4 w-4" />}
              Export
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => runExport("pdf")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              <div>
                <p>PDF report</p>
                <p className="text-xs text-muted-foreground">
                  Summary, breakdowns and lists
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => runExport("xlsx")}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <div>
                <p>Excel (.xlsx)</p>
                <p className="text-xs text-muted-foreground">
                  One sheet per list
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => runExport("csv")}
              className="gap-2"
            >
              <SheetIcon className="h-4 w-4" />
              <div>
                <p>CSV</p>
                <p className="text-xs text-muted-foreground">
                  Plain text, everything in one file
                </p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      {/* Range toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-white p-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1 rounded-md bg-neutral-50 p-0.5 ring-1 ring-inset ring-border">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setRange(presetRange(p.key))}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                activePreset === p.key
                  ? "bg-white text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <Input
            type="date"
            aria-label="From"
            value={from}
            max={to || undefined}
            onChange={(e) => setRange([e.target.value, to])}
            className="h-9 w-full lg:w-40"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To"
            value={to}
            min={from || undefined}
            onChange={(e) => setRange([from, e.target.value])}
            className="h-9 w-full lg:w-40"
          />
        </div>
      </div>

      <div className="-mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Showing{" "}
          <span className="font-medium text-foreground">{rangeLabel}</span>
          {prevLabel && (
            <> · pills compare {prevLabel.replace("vs ", "with ")}</>
          )}
        </span>
        {isFetching && !isLoading && <Spinner />}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Spinner />
          <span>Building report...</span>
        </div>
      ) : (
        <>
          {showHall && (
            <StatGroup
              title="Hall reservations"
              stats={[
                {
                  label: "Total requests",
                  value: hall.total,
                  delta: delta(hall.total, hallPrev?.total),
                },
                {
                  label: "Approved",
                  value: hall.approved,
                  delta: delta(hall.approved, hallPrev?.approved),
                },
                {
                  label: "Pending / in review",
                  value: hall.pending,
                  delta: delta(hall.pending, hallPrev?.pending),
                },
                {
                  label: "Declined / cancelled",
                  value: hall.rejected,
                  delta: delta(hall.rejected, hallPrev?.rejected),
                },
                {
                  label: "Done",
                  value: hall.done,
                  delta: delta(hall.done, hallPrev?.done),
                },
              ]}
            />
          )}
          {showOb && (
            <StatGroup
              title="OB trips"
              stats={[
                {
                  label: "Total trips",
                  value: ob.total,
                  delta: delta(ob.total, obPrev?.total),
                },
                {
                  label: "Approved",
                  value: ob.approved,
                  delta: delta(ob.approved, obPrev?.approved),
                },
                {
                  label: "Pending / in review",
                  value: ob.pending,
                  delta: delta(ob.pending, obPrev?.pending),
                },
                {
                  label: "Declined / cancelled",
                  value: ob.rejected,
                  delta: delta(ob.rejected, obPrev?.rejected),
                },
                {
                  label: "Done",
                  value: ob.done,
                  delta: delta(ob.done, obPrev?.done),
                },
              ]}
            />
          )}
          <StatGroup
            title="Highlights"
            stats={[
              {
                label: "Approval rate",
                value: approvalRate === null ? "—" : `${approvalRate}%`,
                hint:
                  scope === "all"
                    ? "Hall and OB, of decided requests"
                    : "Of decided requests",
              },
              ...(showHall
                ? [
                    {
                      label: "Busiest hall",
                      value: topHalls[0]?.label ?? "—",
                      hint: topHalls[0]
                        ? `${topHalls[0].value} bookings`
                        : undefined,
                    },
                  ]
                : [
                    {
                      label: "Top vehicle",
                      value: obStats.topVehicles[0]?.label ?? "—",
                      hint: obStats.topVehicles[0]
                        ? `${obStats.topVehicles[0].value} trips`
                        : undefined,
                    },
                  ]),
              ...(showOb
                ? [
                    {
                      label: "Top destination",
                      value: obStats.topDestinations[0]?.label ?? "—",
                      hint: obStats.topDestinations[0]
                        ? `${obStats.topDestinations[0].value} trips`
                        : undefined,
                    },
                  ]
                : [
                    {
                      label: "Top department",
                      value: byDepartment[0]?.label ?? "—",
                      hint: byDepartment[0]
                        ? `${byDepartment[0].value} requests`
                        : undefined,
                    },
                  ]),
              {
                label: "Activity entries",
                value: logs.length,
                hint: topUsers[0] ? `Most by ${topUsers[0].label}` : undefined,
              },
              {
                label: "Non-working days",
                value: nonWorkingDays.length,
                hint:
                  scope === "hall"
                    ? "Hall calendar"
                    : scope === "ob"
                      ? "OB calendar"
                      : "Hall and OB calendars",
              },
            ]}
          />

          {showHall && (
            <>
              <SectionHeading
                title="Hall reservations"
                caption="By date of the reservation"
              />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard
                  title="By status"
                  subtitle="Every hall request in the range"
                >
                  <DonutChart data={byStatus} emptyLabel="No hall requests" />
                </ChartCard>
                <ChartCard title="Over time" subtitle="Requests per month">
                  <VBarChart data={byMonth} emptyLabel="No hall requests" />
                </ChartCard>
                <ChartCard
                  title="Top halls"
                  subtitle="Excluding declined and cancelled"
                >
                  <HBarChart data={topHalls} emptyLabel="No hall usage" />
                </ChartCard>
                <ChartCard
                  title="Top equipment"
                  subtitle="Excluding declined and cancelled"
                >
                  <HBarChart
                    data={topEquipment}
                    emptyLabel="No equipment usage"
                  />
                </ChartCard>
                <ChartCard
                  title="By department"
                  subtitle="Who books the halls"
                  className="lg:col-span-2"
                >
                  <HBarChart
                    data={byDepartment}
                    emptyLabel="No hall requests"
                  />
                </ChartCard>
              </div>
            </>
          )}

          {showOb && (
            <>
              <SectionHeading title="OB trips" caption="By departure date" />
              <ObAnalytics trips={obTrips} showStats={false} />
            </>
          )}

          <SectionHeading
            title="Activity and calendar"
            caption={
              scope === "all"
                ? "Logs and non-working days in the range"
                : "Your module's logs and non-working days in the range"
            }
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Activity by action">
              <DonutChart data={byAction} emptyLabel="No activity" />
            </ChartCard>
            <ChartCard title="Most active users" subtitle="By log entries">
              <HBarChart data={topUsers} emptyLabel="No activity" />
            </ChartCard>
            <ChartCard
              title="Non-working days"
              subtitle={
                scope === "hall"
                  ? "Hall calendar"
                  : scope === "ob"
                    ? "OB calendar"
                    : "Hall and OB calendars"
              }
            >
              <DonutChart data={nwdByType} emptyLabel="No non-working days" />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

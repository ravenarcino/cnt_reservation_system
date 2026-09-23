"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ObAnalytics, useObStats, type ObTripRow } from "@/components/ob/ob-analytics";

// OB report: pick a departure date range, see the charts, export a CSV.
export default function ObReportPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: tripData, isLoading } = useQuery({
    queryKey: ["obReservation", "report"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/ob_reservations/reservation");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  // Inclusive range on the departure date; either end may be left open.
  const trips: ObTripRow[] = useMemo(() => {
    const all: ObTripRow[] = tripData?.data ?? [];
    return all.filter((t) => {
      const day = format(new Date(t.time_from), "yyyy-MM-dd");
      return (!from || day >= from) && (!to || day <= to);
    });
  }, [tripData, from, to]);

  const stats = useObStats(trips);

  const rangeLabel =
    from || to ? `${from || "start"} to ${to || "today"}` : "All time";

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines: string[] = [];

    lines.push(esc("CNT Reservation — OB Report"));
    lines.push(esc(`Range: ${rangeLabel}`));
    lines.push("");
    lines.push(esc("Summary"));
    lines.push([esc("Total OB Trips"), esc(stats.total)].join(","));
    lines.push([esc("Pending"), esc(stats.pending)].join(","));
    lines.push("");

    const section = (title: string, rows: { label: string; value: number }[]) => {
      lines.push(esc(title));
      rows.forEach((r) => lines.push([esc(r.label), esc(r.value)].join(",")));
      lines.push("");
    };
    section("OB Trips by Status", stats.byStatus);
    section("Top Vehicles", stats.topVehicles);
    section("Top Destinations", stats.topDestinations);

    lines.push(esc("OB Trip Details"));
    lines.push(
      ["OB ID", "Purpose", "Destination", "Reserved By", "Vehicles", "Drivers", "Status", "Departure", "Return"]
        .map(esc)
        .join(","),
    );
    trips.forEach((t) =>
      lines.push(
        [
          t.ob_id,
          t.purpose,
          t.destination,
          t.ob_user?.name ?? "",
          (t.vehicle ?? []).map((v) => v.vehicle_name).join(" | "),
          (t.drivers ?? []).map((dr) => dr.driver_name).join(" | "),
          t.status,
          format(new Date(t.time_from), "yyyy-MM-dd HH:mm"),
          format(new Date(t.time_to), "yyyy-MM-dd HH:mm"),
        ]
          .map(esc)
          .join(","),
      ),
    );

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ob-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">OB Report</h1>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
        <Button className="bg-brand text-white" onClick={exportCsv} disabled={isLoading}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            min={from || undefined}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {(from || to) && (
          <Button
            variant="outline"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 text-muted-foreground py-20">
          <Spinner />
          <span>Loading report</span>
        </div>
      ) : (
        <ObAnalytics trips={trips} basePath="/ob_admin" showStats={false} />
      )}
    </div>
  );
}

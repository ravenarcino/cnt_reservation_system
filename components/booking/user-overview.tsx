"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, CalendarCheck, CalendarClock, Radio, Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

// The signed-in user's booking summary: four stat cards and an "Up next"
// list of today's and upcoming hall reservations and OB trips. Shown on the
// user's Reservations page. Uses the same query keys as the rest of the user
// pages, so it refreshes whenever a booking is created, edited or cancelled.

type UpNext = {
  id: string;
  kind: "Hall" | "OB";
  title: string;
  where: string;
  start: Date;
  end: Date;
  status: string;
};

const INACTIVE = ["CANCELLED", "DECLINED"];

export function UserOverview() {
  const { data: hallData } = useQuery({
    queryKey: ["hallReservation"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/hall_reservations/reservation");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });
  const { data: obData } = useQuery({
    queryKey: ["obReservation"],
    queryFn: async () => {
      const res = await fetch("/api/reservations/ob_reservations/reservation");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json;
    },
  });

  const { stats, upNext, todayCount, upcomingCount } = useMemo(() => {
    const halls: any[] = hallData?.data ?? [];
    const trips: any[] = obData?.data ?? [];
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const hallItems: UpNext[] = halls
      .filter((r) => !INACTIVE.includes(r.status))
      .map((r) => {
        const day = new Date(r.date_appointment);
        const from = new Date(r.time_from);
        const to = new Date(r.time_to);
        const start = new Date(day);
        start.setHours(from.getHours(), from.getMinutes(), 0, 0);
        const end = new Date(day);
        end.setHours(to.getHours(), to.getMinutes(), 0, 0);
        return {
          id: r.reservation_id,
          kind: "Hall" as const,
          title: r.purpose,
          where: (r.hall ?? []).map((h: { hall_name: string }) => h.hall_name).join(", ") || "—",
          start,
          end,
          status: r.status,
        };
      });
    const obItems: UpNext[] = trips
      .filter((t) => !INACTIVE.includes(t.status))
      .map((t) => ({
        id: t.ob_id,
        kind: "OB" as const,
        title: t.purpose,
        where: t.destination,
        start: new Date(t.time_from),
        end: new Date(t.time_to),
        status: t.status,
      }));

    const live = [...hallItems, ...obItems].filter((i) => i.end >= now && i.status !== "DONE");

    const all = [...halls, ...trips];
    const count = (list: any[], ...st: string[]) => list.filter((r) => st.includes(r.status)).length;
    const monthKey = format(now, "yyyy-MM");
    const active = (list: any[]) => count(list, "PENDING", "APPROVED", "FOR_REVIEW", "FOR_APPROVAL");

    return {
      stats: [
        {
          label: "Total bookings",
          value: all.length,
          icon: Ticket,
          note: `${count(all, "PENDING", "FOR_APPROVAL")} pending · ${count(all, "APPROVED")} approved`,
        },
        {
          label: "Completed",
          value: count(all, "DONE"),
          icon: CalendarCheck,
          note: `${all.filter((r) => r.status === "DONE" && format(new Date(r.updatedAt ?? r.time_to), "yyyy-MM") === monthKey).length} this month`,
        },
        { label: "Hall bookings", value: halls.length, icon: Building2, note: `${active(halls)} active` },
        { label: "OB trips", value: trips.length, icon: Radio, note: `${active(trips)} active` },
      ],
      upNext: live.sort((a, b) => +a.start - +b.start),
      todayCount: live.filter((i) => i.start <= todayEnd && i.end >= todayStart).length,
      upcomingCount: live.filter((i) => i.start > todayEnd).length,
    };
  }, [hallData, obData]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.2fr]">
      {/* One joined strip of stats, split by hairlines */}
      <Card className="gap-0 py-0">
        <div className="grid h-full grid-cols-2 divide-neutral-100 [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(odd)]:border-r [&>*]:border-neutral-100">
          {stats.map(({ label, value, icon: Icon, note }) => (
            <div key={label} className="flex flex-col justify-between p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{note}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="gap-0 py-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Up next</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {todayCount} today · {upcomingCount} upcoming
          </span>
        </div>
        {upNext.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            description="Book a hall or an OB trip from the Dashboard calendar."
            className="py-8"
          />
        ) : (
          <ul className="max-h-[232px] divide-y divide-neutral-100 overflow-y-auto">
            {upNext.slice(0, 8).map((i) => {
              const today = format(i.start, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              return (
                <li key={i.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="w-14 shrink-0 text-center">
                    <p className={`text-[11px] font-medium uppercase ${today ? "text-brand" : "text-muted-foreground"}`}>
                      {today ? "Today" : format(i.start, "EEE")}
                    </p>
                    <p className="text-xl font-semibold leading-tight tabular-nums">{format(i.start, "d")}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{i.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/70">{i.kind}</span> · {i.where} ·{" "}
                      {format(i.start, "h:mm a")} – {format(i.end, "h:mm a")}
                    </p>
                  </div>
                  <StatusBadge status={i.status} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

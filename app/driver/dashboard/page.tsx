"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  differenceInMinutes,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, Car, CheckCircle2, Clock, Mail, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Greeting } from "@/components/dashboard/greeting";
import { StatGroup } from "@/components/dashboard/charts";
import { cn } from "@/lib/utils";

// Driver home. Phone first: a 7-day strip to pick a day, that day's trips as
// a timeline, and the picked (or next) trip's details beside it on desktop or
// in a bottom sheet on phones. An approved trip can be marked done once it
// has ended.

type Trip = {
  ob_id: string;
  purpose: string;
  destination: string;
  passengers_qty: number;
  status: string;
  time_from: string;
  time_to: string;
  other_request: string | null;
  vehicle: { vehicle_id: string; vehicle_name: string; plate_number?: string | null }[];
  drivers: { driver_id: string; driver_name: string }[];
  ob_user: { name: string; email: string; department: string } | null;
};

type DayOff = { date_from: string; date_to: string; status: string };

const dayEnd = (d: Date) => {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
};
const touches = (t: Trip, day: Date) =>
  new Date(t.time_from) <= dayEnd(day) && new Date(t.time_to) >= startOfDay(day);

function timeRange(t: Trip) {
  const from = new Date(t.time_from);
  const to = new Date(t.time_to);
  return isSameDay(from, to)
    ? `${format(from, "h:mm a")} – ${format(to, "h:mm a")}`
    : `${format(from, "MMM d, h:mm a")} – ${format(to, "MMM d, h:mm a")}`;
}

// "Starts in 2h 10m", "On the road · back 5:00 PM", "Ended".
function phase(t: Trip, now: Date) {
  const from = new Date(t.time_from);
  const to = new Date(t.time_to);
  if (t.status === "DONE") return { label: "Done", tone: "text-sky-700" };
  if (now >= to) return { label: "Ended · mark it done", tone: "text-amber-700" };
  if (now >= from) return { label: `On the road · back ${format(to, "h:mm a")}`, tone: "text-red-700" };
  const mins = differenceInMinutes(from, now);
  if (mins < 60) return { label: `Starts in ${mins}m`, tone: "text-amber-700" };
  if (mins < 24 * 60) return { label: `Starts in ${Math.floor(mins / 60)}h ${mins % 60}m`, tone: "text-muted-foreground" };
  return { label: format(from, "EEE, MMM d"), tone: "text-muted-foreground" };
}

export default function DriverDashboard() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Ticks every minute so "Starts in 20m" and the Mark as done button stay current.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["driverTrips"],
    queryFn: async () => {
      const res = await fetch("/api/driver/trips");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { driver: { driver_name: string } | null; data: Trip[] };
    },
  });
  const trips = useMemo(() => data?.data ?? [], [data]);

  const { data: dayOffData } = useQuery({
    queryKey: ["driverDayOff"],
    queryFn: async () => {
      const res = await fetch("/api/driver/dayoff");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: DayOff[] };
    },
  });
  const approvedOffs = (dayOffData?.data ?? []).filter((d) => d.status === "APPROVED");
  const isOff = (d: Date) =>
    approvedOffs.some((o) => startOfDay(new Date(o.date_from)) <= d && new Date(o.date_to) >= startOfDay(d));

  const today = startOfDay(now);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  // Approved trips that already ended but nobody closed out.
  const toClose = trips.filter((t) => t.status === "APPROVED" && new Date(t.time_to) <= now);
  const dayTrips = trips.filter((t) => touches(t, day));
  const upcoming = trips.filter((t) => t.status === "APPROVED" && new Date(t.time_to) > now);
  const nextOff = approvedOffs
    .filter((o) => new Date(o.date_to) >= today)
    .sort((a, b) => new Date(a.date_from).getTime() - new Date(b.date_from).getTime())[0];

  // Side panel: the trip the driver tapped, else the current or next one.
  const picked =
    trips.find((t) => t.ob_id === pickedId) ??
    upcoming.find((t) => new Date(t.time_from) <= now) ??
    upcoming[0] ??
    null;

  function pick(t: Trip) {
    setPickedId(t.ob_id);
    // On phones the details open in a bottom sheet instead of the side panel.
    if (!window.matchMedia("(min-width: 1024px)").matches) setSheetOpen(true);
  }

  async function markDone(trip: Trip) {
    setBusyId(trip.ob_id);
    const loading = toast.loading("Marking trip as done...");
    try {
      const res = await fetch(`/api/reservations/ob_reservations/action/${trip.ob_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DONE" }),
      });
      const json = await res.json();
      toast.dismiss(loading);
      if (!res.ok) {
        toast.error(json?.error ?? "Failed to mark trip as done");
        return;
      }
      toast.success("Trip has been marked as done");
      queryClient.invalidateQueries({ queryKey: ["driverTrips"] });
    } catch {
      toast.dismiss(loading);
      toast.error("Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
        <Spinner />
        <span>Loading your trips...</span>
      </div>
    );
  }

  if (!data?.driver) {
    return (
      <div className="flex flex-col gap-5">
        <Greeting caption={format(now, "EEEE, MMMM d")} />
        <EmptyState
          title="Your account isn't linked to a driver yet"
          description="Ask the OB admin to link your account in Driver Management, then reload this page."
        />
      </div>
    );
  }

  const dayOff = isOff(day);

  return (
    <div className="flex flex-col gap-5">
      <Greeting caption={`${data.driver.driver_name} · ${format(now, "EEEE, MMMM d")}`} />

      <StatGroup
        title="Your week"
        stats={[
          { label: "Today", value: trips.filter((t) => t.status === "APPROVED" && touches(t, today)).length, hint: "Approved trips" },
          {
            label: "Next 7 days",
            value: upcoming.filter((t) => new Date(t.time_from) <= dayEnd(addDays(today, 6))).length,
            hint: `${upcoming.length} upcoming in total`,
          },
          { label: "To mark done", value: toClose.length, hint: toClose.length ? "Trips already ended" : "All closed" },
          {
            label: "Next day off",
            value: nextOff ? format(new Date(nextOff.date_from), "MMM d") : "—",
            hint: nextOff ? format(new Date(nextOff.date_from), "EEEE") : "None approved",
          },
        ]}
      />

      {/* Ended trips waiting to be closed */}
      {toClose.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2 border-b border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            {toClose.length === 1 ? "1 trip has ended" : `${toClose.length} trips have ended`} — mark {toClose.length === 1 ? "it" : "them"} done
          </div>
          <ul className="divide-y divide-amber-200">
            {toClose.map((t) => (
              <li key={t.ob_id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => pick(t)} className="min-w-0 text-left">
                  <p className="truncate text-sm font-medium">{t.destination}</p>
                  <p className="text-xs text-amber-900/70">
                    {format(new Date(t.time_from), "EEE, MMM d")} · {timeRange(t)} · {t.ob_user?.name}
                  </p>
                </button>
                <Button
                  className="h-10 w-full sm:w-auto"
                  disabled={busyId === t.ob_id}
                  onClick={() => markDone(t)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {busyId === t.ob_id ? "Marking..." : "Mark as done"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 7-day picker; scrolls sideways on phones */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="grid min-w-[560px] grid-cols-7 gap-2 sm:min-w-0">
          {week.map((d, i) => {
            const count = trips.filter((t) => t.status !== "DONE" && touches(t, d)).length;
            const off = isOff(d);
            const on = isSameDay(d, day);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setDay(d)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border bg-white px-1 py-2.5 text-center transition-colors",
                  on ? "border-brand bg-brand-soft" : "border-border hover:bg-neutral-50",
                )}
              >
                <span className={cn("text-[11px] font-semibold uppercase", on ? "text-brand" : "text-muted-foreground")}>
                  {i === 0 ? "Today" : format(d, "EEE")}
                </span>
                <span className="text-lg font-semibold leading-none tabular-nums">{format(d, "d")}</span>
                <span
                  className={cn(
                    "mt-0.5 rounded-full px-1.5 text-[10px] font-medium",
                    off
                      ? "bg-violet-100 text-violet-800"
                      : count > 0
                        ? "bg-emerald-100 text-emerald-800"
                        : "text-muted-foreground",
                  )}
                >
                  {off ? "Day off" : count > 0 ? `${count} trip${count > 1 ? "s" : ""}` : "Free"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        {/* Timeline for the picked day */}
        <section className="overflow-hidden rounded-lg border border-border bg-white">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">
                {isSameDay(day, today) ? "Today" : format(day, "EEEE")}
                <span className="ml-1.5 font-normal text-muted-foreground">{format(day, "MMM d")}</span>
              </p>
              <p className="text-xs text-muted-foreground">Tap a trip to see details</p>
            </div>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
              {dayTrips.length} trip{dayTrips.length === 1 ? "" : "s"}
            </span>
          </div>

          {dayTrips.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <Car className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">{dayOff ? "You're on a day off" : "No trips this day"}</p>
              <p className="text-xs text-muted-foreground">
                {dayOff ? "Enjoy your rest." : "New trips show up here once the OB admin assigns you."}
              </p>
            </div>
          ) : (
            <ol className="relative px-4 py-4">
              {dayTrips.map((t, i) => {
                const ph = phase(t, now);
                const on = picked?.ob_id === t.ob_id;
                const from = new Date(t.time_from);
                const live = t.status === "APPROVED" && from <= now && now < new Date(t.time_to);
                return (
                  <li key={t.ob_id} className="relative flex gap-3 pb-4 last:pb-0">
                    {/* time column + rail */}
                    <div className="flex w-14 shrink-0 flex-col items-end pt-3">
                      <span className="text-xs font-semibold tabular-nums">{format(from, "h:mm")}</span>
                      <span className="text-[10px] uppercase text-muted-foreground">{format(from, "a")}</span>
                    </div>
                    <div className="relative flex flex-col items-center">
                      <span
                        className={cn(
                          "mt-4 h-2.5 w-2.5 rounded-full ring-4 ring-white",
                          live ? "bg-red-500" : t.status === "DONE" ? "bg-sky-500" : "bg-emerald-500",
                        )}
                      />
                      {i < dayTrips.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <button
                      type="button"
                      onClick={() => pick(t)}
                      className={cn(
                        "min-w-0 flex-1 rounded-lg border p-3 text-left transition-colors",
                        on ? "border-brand bg-brand-soft/40" : "border-border hover:bg-neutral-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{t.destination}</p>
                        <StatusBadge status={t.status} className="shrink-0" />
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{timeRange(t)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {t.ob_user?.name ?? "Unknown"} · {t.passengers_qty} pax
                        </span>
                        {t.vehicle[0] && (
                          <span className="inline-flex items-center gap-1">
                            <Car className="h-3.5 w-3.5" /> {t.vehicle.map((v) => v.vehicle_name).join(", ")}
                          </span>
                        )}
                      </div>
                      <p className={cn("mt-2 text-xs font-medium", ph.tone)}>{ph.label}</p>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* Details: side panel on desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 overflow-hidden rounded-lg border border-border bg-white">
            <p className="border-b border-border bg-neutral-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {pickedId ? "Trip details" : "Next trip"}
            </p>
            {picked ? (
              <TripDetails trip={picked} now={now} busy={busyId === picked.ob_id} onDone={markDone} />
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No upcoming trips</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Details: bottom sheet on phones */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-xl p-0">
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle>Trip details</SheetTitle>
            <SheetDescription className="sr-only">Details of the selected trip</SheetDescription>
          </SheetHeader>
          {picked && <TripDetails trip={picked} now={now} busy={busyId === picked.ob_id} onDone={markDone} sticky />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TripDetails({
  trip,
  now,
  busy,
  onDone,
  sticky,
}: {
  trip: Trip;
  now: Date;
  busy: boolean;
  onDone: (t: Trip) => void;
  sticky?: boolean;
}) {
  const from = new Date(trip.time_from);
  const ended = new Date(trip.time_to) <= now;
  const ph = phase(trip, now);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="font-mono text-[11px] text-muted-foreground">{trip.ob_id}</p>
            <StatusBadge status={trip.status} />
          </div>
          <p className="mt-1 text-lg font-semibold leading-tight">{trip.destination}</p>
          <p className="text-sm text-muted-foreground">
            {format(from, "EEE, MMM d")} · {timeRange(trip)}
          </p>
          <p className={cn("mt-1 text-xs font-medium", ph.tone)}>{ph.label}</p>
        </div>

        <dl className="grid grid-cols-1 gap-3 text-sm">
          <Item icon={<Users className="h-4 w-4" />} label="Passenger">
            <p className="font-medium">{trip.ob_user?.name ?? "Unknown"}</p>
            <p className="text-xs text-muted-foreground">
              {trip.ob_user?.department ?? "—"} · {trip.passengers_qty} passenger{trip.passengers_qty === 1 ? "" : "s"}
            </p>
            {trip.ob_user?.email && (
              <a href={`mailto:${trip.ob_user.email}`} className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand hover:underline">
                <Mail className="h-3 w-3" /> {trip.ob_user.email}
              </a>
            )}
          </Item>
          <Item icon={<Car className="h-4 w-4" />} label="Vehicle">
            {trip.vehicle.length ? (
              trip.vehicle.map((v) => (
                <p key={v.vehicle_id} className="flex flex-wrap items-center gap-2 font-medium">
                  {v.vehicle_name}
                  {v.plate_number && (
                    <span className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wider">
                      {v.plate_number}
                    </span>
                  )}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">Not assigned</p>
            )}
          </Item>
          {trip.drivers.length > 1 && (
            <Item icon={<Users className="h-4 w-4" />} label="With">
              <p className="font-medium">{trip.drivers.map((d) => d.driver_name).join(", ")}</p>
            </Item>
          )}
          <Item icon={<MapPin className="h-4 w-4" />} label="Purpose">
            <p className="whitespace-pre-wrap">{trip.purpose}</p>
          </Item>
          {trip.other_request && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Note from requester</p>
              <p className="mt-0.5 whitespace-pre-wrap">{trip.other_request}</p>
            </div>
          )}
        </dl>
      </div>

      {trip.status === "APPROVED" && (
        <div className={cn("border-t border-border bg-white p-4", sticky && "sticky bottom-0")}>
          <Button className="h-11 w-full" disabled={!ended || busy} onClick={() => onDone(trip)}>
            <CheckCircle2 className="h-4 w-4" />
            {busy ? "Marking..." : "Mark as done"}
          </Button>
          {!ended && (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">
              Available after {format(new Date(trip.time_to), "MMM d, h:mm a")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Item({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}

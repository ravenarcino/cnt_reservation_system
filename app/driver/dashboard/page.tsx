"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, CalendarDays, Car, CheckCircle2, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

// Driver home: today's trips first, then the upcoming ones. A driver can mark
// an approved trip as done once it has ended.

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

export default function DriverDashboard() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["driverTrips"],
    queryFn: async () => {
      const res = await fetch("/api/driver/trips");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { driver: { driver_name: string } | null; data: Trip[] };
    },
  });

  const trips = data?.data ?? [];

  // Approved day offs, for marking them on the week strip.
  const { data: dayOffData } = useQuery({
    queryKey: ["driverDayOff"],
    queryFn: async () => {
      const res = await fetch("/api/driver/dayoff");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      return json as { data: { date_from: string; date_to: string; status: string }[] };
    },
  });
  const approvedOffs = (dayOffData?.data ?? []).filter((d) => d.status === "APPROVED");

  const { today, upcoming, pendingDone } = useMemo(() => {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return {
      // Any trip that touches today, including multi-day ones.
      today: trips.filter(
        (t) => new Date(t.time_from) <= todayEnd && new Date(t.time_to) >= todayStart,
      ),
      upcoming: trips.filter((t) => new Date(t.time_from) > todayEnd),
      // Approved trips from before today that nobody closed out yet.
      pendingDone: trips.filter(
        (t) => t.status === "APPROVED" && new Date(t.time_to) < todayStart && new Date(t.time_to) < now,
      ),
    };
  }, [trips]);

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        <span>Loading trips...</span>
      </div>
    );
  }

  if (!data?.driver) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="page-title">My Trips</h1>
        <p className="text-sm text-muted-foreground">
          Your account is not linked to a driver record yet. Ask the OB admin to
          link it in Driver Management.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">My Trips</h1>
        <p className="text-sm text-muted-foreground">
          {data.driver.driver_name} · {format(new Date(), "EEEE, MMMM d, yyyy")}
        </p>
      </div>

      <WeekStrip trips={trips} dayOffs={approvedOffs} />

      <Section title="Today's Trips" icon={<Car className="h-4 w-4" />} accent="green" empty="No trips today" trips={today} onDone={markDone} busyId={busyId} />
      {pendingDone.length > 0 && (
        <Section
          title="Finished, not yet marked done"
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="amber"
          empty=""
          trips={pendingDone}
          onDone={markDone}
          busyId={busyId}
        />
      )}
      <Section title="Upcoming Trips" icon={<CalendarDays className="h-4 w-4" />} accent="blue" empty="No upcoming trips" trips={upcoming} onDone={markDone} busyId={busyId} />
    </div>
  );
}

function Section({
  title,
  empty,
  trips,
  onDone,
  busyId,
  icon,
  accent = "green",
}: {
  title: string;
  empty: string;
  trips: Trip[];
  onDone: (t: Trip) => void;
  busyId: string | null;
  icon?: React.ReactNode;
  accent?: "green" | "blue" | "amber";
}) {
  const tones = {
    green: { bar: "bg-brand", chip: "bg-brand-soft text-brand", icon: "bg-brand-soft text-brand" },
    blue: { bar: "bg-blue-700", chip: "bg-blue-100 text-blue-800", icon: "bg-blue-100 text-blue-700" },
    amber: { bar: "bg-amber-500", chip: "bg-amber-100 text-amber-800", icon: "bg-amber-100 text-amber-700" },
  }[accent];

  return (
    <Card className="shadow-sm overflow-hidden gap-0 py-0">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            {icon ?? <CalendarClock className="h-4 w-4" />}
          </span>
          <p className="text-base font-semibold">{title}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones.chip}`}>
          {trips.length} trip{trips.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="p-5">
        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
            <Car className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {trips.map((t) => (
              <TripCard key={t.ob_id} trip={t} onDone={onDone} busy={busyId === t.ob_id} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function TripCard({ trip, onDone, busy }: { trip: Trip; onDone: (t: Trip) => void; busy: boolean }) {
  const from = new Date(trip.time_from);
  const to = new Date(trip.time_to);
  const ended = to <= new Date();
  const sameDay = isSameDay(from, to);

  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{trip.ob_user?.name ?? "Unknown"}</CardTitle>
          <StatusBadge status={trip.status} className="shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground">
          {trip.ob_user?.department} · {trip.ob_id}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <Row icon={<CalendarClock className="h-4 w-4" />}>
          {sameDay
            ? `${format(from, "MMM d")}, ${format(from, "h:mm a")} – ${format(to, "h:mm a")}`
            : `${format(from, "MMM d, h:mm a")} – ${format(to, "MMM d, h:mm a")}`}
        </Row>
        <Row icon={<MapPin className="h-4 w-4" />}>{trip.destination}</Row>
        <Row icon={<Car className="h-4 w-4" />}>
          {trip.vehicle
            .map((v) => v.vehicle_name + (v.plate_number ? ` (${v.plate_number})` : ""))
            .join(", ") || "—"}
        </Row>
        <Row icon={<Users className="h-4 w-4" />}>{trip.passengers_qty} passenger(s)</Row>
        <p className="text-muted-foreground">{trip.purpose}</p>
        {trip.other_request && (
          <p className="text-xs text-muted-foreground">Note: {trip.other_request}</p>
        )}

        {trip.status === "APPROVED" && (
          <Button
            className="mt-2 w-full bg-blue-700 rounded-sm text-white"
            disabled={!ended || busy}
            onClick={() => onDone(trip)}
          >
            {busy ? "Marking..." : ended ? "Mark as Done" : "Mark as Done (not yet finished)"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

// Today and the next six days: trips per day, and approved day offs.
function WeekStrip({
  trips,
  dayOffs,
}: {
  trips: Trip[];
  dayOffs: { date_from: string; date_to: string }[];
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, i) => {
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);

        const count = trips.filter(
          (t) =>
            t.status === "APPROVED" &&
            new Date(t.time_from) <= dayEnd &&
            new Date(t.time_to) >= day,
        ).length;
        const off = dayOffs.some(
          (d) => startOfDay(new Date(d.date_from)) <= day && new Date(d.date_to) >= day,
        );

        const tone = off
          ? "border-red-200 bg-red-50"
          : count > 0
            ? "border-green-200 bg-green-50"
            : "bg-white";

        return (
          <div
            key={day.toISOString()}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center shadow-sm ${tone} ${
              i === 0 ? "ring-2 ring-brand" : ""
            }`}
          >
            <span className="text-[11px] font-medium uppercase text-muted-foreground">
              {i === 0 ? "Today" : format(day, "EEE")}
            </span>
            <span className="text-lg font-bold leading-none">{format(day, "d")}</span>
            <span
              className={`text-[11px] font-medium ${
                off ? "text-red-700" : count > 0 ? "text-green-800" : "text-muted-foreground"
              }`}
            >
              {off ? "Day off" : count > 0 ? `${count} trip${count > 1 ? "s" : ""}` : "Free"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

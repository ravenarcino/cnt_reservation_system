"use client";

import Link from "next/link";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { ArrowRight, CalendarX, Car } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LogAction, TypeChip } from "@/components/log-action";
import { cn } from "@/lib/utils";

// Tables for the bottom of the admin dashboard: pending approvals, today's
// schedule, recent activity, upcoming non-working days and vehicles out today.

type Hall = {
  reservation_id: string;
  purpose: string;
  status: string;
  date_appointment: string;
  time_from: string;
  time_to: string;
  createdAt?: string;
  hall?: { hall_name: string }[];
  hall_user?: { name: string; department?: string } | null;
};
type Ob = {
  ob_id: string;
  purpose: string;
  destination: string;
  status: string;
  time_from: string;
  time_to: string;
  createdAt?: string;
  vehicle?: { vehicle_name: string }[];
  drivers?: { driver_name: string }[];
  ob_user?: { name: string } | null;
};
type Log = {
  log_id: string;
  event: string;
  event_type: string;
  changes?: string | null;
  reservationId?: string | null;
  obReservationId?: string | null;
  reservation_type?: string | null;
  createdAt: string;
  user_personal_info_log?: { name: string } | null;
};
type Nwd = { nwd_id: string; date: string; description: string; nwd_type?: string };

const WAITING = ["PENDING", "FOR_APPROVAL", "FOR_REVIEW"];
const INACTIVE = ["CANCELLED", "DECLINED"];

// Hall bookings store the day and the times separately.
function hallWindow(r: Hall) {
  const day = new Date(r.date_appointment);
  const from = new Date(r.time_from);
  const to = new Date(r.time_to);
  const start = new Date(day);
  start.setHours(from.getHours(), from.getMinutes(), 0, 0);
  const end = new Date(day);
  end.setHours(to.getHours(), to.getMinutes(), 0, 0);
  return { start, end };
}

// ------------------------------------------------------------------ shell

export function TableCard({
  title,
  subtitle,
  href,
  hrefLabel = "View all",
  count,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  count?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col overflow-hidden rounded-lg border border-border bg-white", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {title}
            {count !== undefined && (
              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {count}
              </span>
            )}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {href && (
          <Link href={href} className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand hover:underline">
            {hrefLabel} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

export function Person({ name, sub }: { name?: string | null; sub?: string | null }) {
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-muted-foreground">
        {initials || "?"}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name ?? "Unknown"}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------ pending approvals

export function PendingApprovals({
  halls,
  trips,
  hallHref,
  obHref,
}: {
  halls: Hall[];
  trips: Ob[];
  hallHref: string;
  obHref: string;
}) {
  const rows = [
    ...halls
      .filter((r) => WAITING.includes(r.status))
      .map((r) => ({
        id: r.reservation_id,
        type: "Hall",
        who: r.hall_user?.name,
        dept: r.hall_user?.department,
        what: r.purpose,
        where: (r.hall ?? []).map((h) => h.hall_name).join(", "),
        start: hallWindow(r).start,
        filed: r.createdAt,
        status: r.status,
        href: hallHref,
      })),
    ...trips
      .filter((t) => WAITING.includes(t.status))
      .map((t) => ({
        id: t.ob_id,
        type: "OB",
        who: t.ob_user?.name,
        dept: undefined,
        what: t.purpose,
        where: t.destination,
        start: new Date(t.time_from),
        filed: t.createdAt,
        status: t.status,
        href: obHref,
      })),
  ].sort((a, b) => +a.start - +b.start);

  return (
    <TableCard title="Pending approvals" subtitle="Requests waiting for a decision, soonest first" count={rows.length}>
      {rows.length === 0 ? (
        <EmptyState title="All caught up" description="No hall or OB requests are waiting for approval." />
      ) : (
        <div className="max-h-[360px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requester</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Filed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Person name={r.who} sub={r.dept} />
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <p className="truncate font-medium">{r.what}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-mono">{r.id}</span> · {r.where || "—"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <TypeChip type={r.type} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p>{format(r.start, "EEE, MMM d")}</p>
                    <p className="text-xs text-muted-foreground">{format(r.start, "h:mm a")}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {r.filed ? formatDistanceToNow(new Date(r.filed), { addSuffix: true }) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={r.href}
                      className="inline-flex h-8 items-center rounded-md border border-border bg-white px-3 text-xs font-medium hover:bg-neutral-50"
                    >
                      Review
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </TableCard>
  );
}

// ------------------------------------------------------- today's schedule

export function TodaySchedule({ halls, trips, className }: { halls: Hall[]; trips: Ob[]; className?: string }) {
  const now = new Date();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const rows = [
    ...halls
      .filter((r) => !INACTIVE.includes(r.status) && isSameDay(new Date(r.date_appointment), now))
      .map((r) => {
        const w = hallWindow(r);
        return {
          id: r.reservation_id,
          type: "Hall",
          ...w,
          what: r.purpose,
          where: (r.hall ?? []).map((h) => h.hall_name).join(", "),
          who: r.hall_user?.name,
          status: r.status,
        };
      }),
    ...trips
      .filter(
        (t) =>
          !INACTIVE.includes(t.status) && new Date(t.time_from) <= dayEnd && new Date(t.time_to) >= dayStart,
      )
      .map((t) => ({
        id: t.ob_id,
        type: "OB",
        start: new Date(t.time_from),
        end: new Date(t.time_to),
        what: t.purpose,
        where: `${(t.vehicle ?? []).map((v) => v.vehicle_name).join(", ") || "—"} → ${t.destination}`,
        who: t.ob_user?.name,
        status: t.status,
      })),
  ].sort((a, b) => +a.start - +b.start);

  return (
    <TableCard
      title="Today's schedule"
      subtitle={format(now, "EEEE, MMMM d")}
      count={rows.length}
      className={className}
    >
      {rows.length === 0 ? (
        <EmptyState title="Nothing booked today" />
      ) : (
        <div className="max-h-[320px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const live = r.start <= now && r.end >= now;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-brand" : "bg-transparent")} />
                        <div>
                          <p className="font-medium">{format(r.start, "h:mm a")}</p>
                          <p className="text-xs text-muted-foreground">to {format(r.end, isSameDay(r.start, r.end) ? "h:mm a" : "MMM d, h:mm a")}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[260px]">
                      <p className="truncate font-medium">{r.what}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/70">{r.type}</span> · {r.where || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{r.who ?? "—"}</TableCell>
                    <TableCell>
                      {live ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand ring-1 ring-inset ring-red-200">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> In progress
                        </span>
                      ) : (
                        <StatusBadge status={r.status} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </TableCard>
  );
}

// -------------------------------------------------------- recent activity

export function RecentActivity({ logs, href, className }: { logs: Log[]; href: string; className?: string }) {
  const rows = [...logs].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 8);
  return (
    <TableCard title="Recent activity" subtitle="Latest actions across the system" href={href} className={className}>
      {rows.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.log_id}>
                <TableCell>
                  <LogAction event={l.event} eventType={l.event_type} />
                </TableCell>
                <TableCell className="text-sm">{l.user_personal_info_log?.name ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <TypeChip type={l.reservation_type ?? null} />
                    <span className="font-mono text-xs text-muted-foreground">
                      {l.reservationId ?? l.obReservationId ?? ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  );
}

// --------------------------------------------- upcoming non-working days

export function UpcomingNonWorking({ days, href }: { days: Nwd[]; href: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = days
    .filter((d) => new Date(d.date) >= today)
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .slice(0, 6);

  return (
    <TableCard title="Upcoming non-working days" href={href} hrefLabel="Calendar">
      {rows.length === 0 ? (
        <EmptyState title="None scheduled" icon={<CalendarX className="h-5 w-5" strokeWidth={1.5} />} />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map((d) => (
            <li key={d.nwd_id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md border border-border">
                <span className="text-[9px] font-semibold uppercase text-brand">{format(new Date(d.date), "MMM")}</span>
                <span className="text-sm font-semibold leading-none tabular-nums">{format(new Date(d.date), "d")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.description}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(d.date), "EEEE")}</p>
              </div>
              {d.nwd_type && <TypeChip type={d.nwd_type === "HALL" ? "Hall" : "OB"} />}
            </li>
          ))}
        </ul>
      )}
    </TableCard>
  );
}

// ------------------------------------------------------ vehicles out today

export function OnTheRoad({ trips, href }: { trips: Ob[]; href: string }) {
  const now = new Date();
  const rows = trips
    .filter((t) => t.status === "APPROVED" && new Date(t.time_from) <= now && new Date(t.time_to) >= now)
    .sort((a, b) => +new Date(a.time_to) - +new Date(b.time_to));

  return (
    <TableCard title="On the road now" subtitle="Approved trips in progress" count={rows.length} href={href} hrefLabel="Vehicles">
      {rows.length === 0 ? (
        <EmptyState title="All vehicles are in" icon={<Car className="h-5 w-5" strokeWidth={1.5} />} />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map((t) => (
            <li key={t.ob_id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">
                  {(t.vehicle ?? []).map((v) => v.vehicle_name).join(", ") || "—"}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">back {format(new Date(t.time_to), "h:mm a")}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {t.destination} · {(t.drivers ?? []).map((d) => d.driver_name).join(", ") || "No driver"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </TableCard>
  );
}

// ----------------------------------------------------- recent reservations

// The latest bookings across halls and OB trips, newest first.
export function RecentReservations({
  halls,
  trips,
  href,
  limit = 10,
}: {
  halls: Hall[];
  trips: Ob[];
  href: string;
  limit?: number;
}) {
  const rows = [
    ...halls.map((r) => ({
      id: r.reservation_id,
      type: "Hall",
      who: r.hall_user?.name,
      dept: r.hall_user?.department,
      what: r.purpose,
      where: (r.hall ?? []).map((h) => h.hall_name).join(", "),
      start: hallWindow(r).start,
      end: hallWindow(r).end,
      filed: r.createdAt ? new Date(r.createdAt) : null,
      status: r.status,
    })),
    ...trips.map((t) => ({
      id: t.ob_id,
      type: "OB",
      who: t.ob_user?.name,
      dept: undefined as string | undefined,
      what: t.purpose,
      where: `${t.destination}${(t.vehicle ?? []).length ? ` · ${(t.vehicle ?? []).map((v) => v.vehicle_name).join(", ")}` : ""}`,
      start: new Date(t.time_from),
      end: new Date(t.time_to),
      filed: t.createdAt ? new Date(t.createdAt) : null,
      status: t.status,
    })),
  ]
    .sort((a, b) => +(b.filed ?? b.start) - +(a.filed ?? a.start))
    .slice(0, limit);

  return (
    <TableCard title="Recent reservations" subtitle="Latest hall and OB bookings" href={href}>
      {rows.length === 0 ? (
        <EmptyState title="No reservations yet" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Venue / Destination</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Filed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                  <TableCell>
                    <Person name={r.who} sub={r.dept} />
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">{r.what}</TableCell>
                  <TableCell>
                    <TypeChip type={r.type} />
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">{r.where || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p>{format(r.start, "MMM d, yyyy")}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {format(r.start, "h:mm a")} – {format(r.end, isSameDay(r.start, r.end) ? "h:mm a" : "MMM d, h:mm a")}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {r.filed ? formatDistanceToNow(r.filed, { addSuffix: true }) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </TableCard>
  );
}

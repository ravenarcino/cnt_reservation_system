"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { format } from "date-fns";

// Floating card listing everyone's reservations on a calendar day.
//
// Kept as its own component with its own state on purpose: the dashboard is a
// very large component, and if the hovered date lived in its state every hover
// would re-render the whole calendar. The dashboard drives this through a ref
// instead (show / hide), so only this small card re-renders.

type HallBooking = {
  reservation_id: string;
  purpose: string;
  status: string;
  time_from: string;
  time_to: string;
  hall: { hall_id: string; hall_name: string }[];
  hall_user: { name: string } | null;
};

type ObTrip = {
  ob_id: string;
  purpose: string;
  destination: string;
  status: string;
  time_from: string;
  time_to: string;
  vehicle: { vehicle_id: string; vehicle_name: string }[];
  ob_user: { name: string } | null;
};

export type DateHoverPopupHandle = {
  show: (date: Date, clientX: number, clientY: number) => void;
  hide: () => void;
};

type Props = {
  tab: "HALL" | "OB";
  hallBookings: HallBooking[];
  obTrips: ObTrip[];
};

const WIDTH = 300;
const GAP = 14;

const STATUS_TONE: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  FOR_REVIEW: "bg-orange-100 text-orange-800",
  FOR_APPROVAL: "bg-orange-100 text-orange-800",
  DONE: "bg-gray-100 text-gray-700",
};

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const DateHoverPopup = forwardRef<DateHoverPopupHandle, Props>(
  function DateHoverPopup({ tab, hallBookings, obTrips }, ref) {
    const [state, setState] = useState<{ date: Date; x: number; y: number } | null>(
      null,
    );
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(ref, () => ({
      show(date, clientX, clientY) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        setState((prev) =>
          // Moving between the header and the body of the same day must not
          // make the card jump - keep the first position for that day.
          prev && prev.date.toDateString() === date.toDateString()
            ? prev
            : { date, x: clientX, y: clientY },
        );
      },
      hide() {
        // A short delay bridges the gap when the pointer crosses from a day's
        // header to its body, so the card does not flicker.
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setState(null), 80);
      },
    }));

    if (!state) return null;

    const dayStart = new Date(state.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(state.date);
    dayEnd.setHours(23, 59, 59, 999);

    const onDay = (from: string, to: string) =>
      new Date(from) <= dayEnd && new Date(to) >= dayStart;

    const items =
      tab === "HALL"
        ? hallBookings
            .filter((b) => onDay(b.time_from, b.time_to))
            .sort((a, b) => +new Date(a.time_from) - +new Date(b.time_from))
            .map((b) => ({
              id: b.reservation_id,
              name: b.hall_user?.name ?? "Unknown",
              where: b.hall.map((h) => h.hall_name).join(", ") || "—",
              when: `${format(new Date(b.time_from), "h:mm a")} – ${format(
                new Date(b.time_to),
                "h:mm a",
              )}`,
              purpose: b.purpose,
              status: b.status,
            }))
        : obTrips
            .filter((t) => onDay(t.time_from, t.time_to))
            .sort((a, b) => +new Date(a.time_from) - +new Date(b.time_from))
            .map((t) => ({
              id: t.ob_id,
              name: t.ob_user?.name ?? "Unknown",
              where: `${t.vehicle.map((v) => v.vehicle_name).join(", ") || "—"} → ${
                t.destination
              }`,
              // A trip may span days, so show the dates too.
              when: `${format(new Date(t.time_from), "MMM d, h:mm a")} – ${format(
                new Date(t.time_to),
                "MMM d, h:mm a",
              )}`,
              purpose: t.purpose,
              status: t.status,
            }));

    // Nothing booked that day - no card at all rather than an empty one.
    if (items.length === 0) return null;

    // Keep the card on screen: flip left / up when it would overflow.
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const vh = typeof window !== "undefined" ? window.innerHeight : 800;
    const left =
      state.x + GAP + WIDTH > vw ? Math.max(8, state.x - GAP - WIDTH) : state.x + GAP;
    const maxHeight = Math.min(360, vh - 16);
    const top = Math.max(8, Math.min(state.y + GAP, vh - maxHeight - 8));

    return (
      <div
        // Informational only - let the pointer pass through to the calendar.
        className="pointer-events-none fixed z-50 rounded-lg border bg-white p-3 shadow-lg"
        style={{ left, top, width: WIDTH, maxHeight, overflowY: "auto" }}
      >
        <p className="mb-2 text-sm font-semibold">
          {format(state.date, "EEEE, MMM d")}
          <span className="ml-1 font-normal text-muted-foreground">
            · {items.length} {tab === "HALL" ? "reservation" : "trip"}
            {items.length === 1 ? "" : "s"}
          </span>
        </p>

        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border p-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm">{item.name}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    STATUS_TONE[item.status] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {statusLabel(item.status)}
                </span>
              </div>
              <p className="text-muted-foreground">{item.when}</p>
              <p className="text-muted-foreground">{item.where}</p>
              <p className="mt-0.5">{item.purpose}</p>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

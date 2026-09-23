import { format, isSameDay } from "date-fns";

// Today's status for a vehicle or driver, worked out from OB trips.
// Pure function - both management pages share it so their wording matches.

type Trip = {
  status: string;
  time_from: string;
  time_to: string;
};

export type TodayStatus = { label: string; tone: string };

const GREEN = "text-green-600";
const AMBER = "text-amber-600";
const RED = "text-red-600";

export function todayStatus(
  trips: Trip[],
  manualBlock: string | null,
  now: Date = new Date(),
): TodayStatus {
  // A manual status set by the admin overrides the schedule.
  if (manualBlock) return { label: manualBlock, tone: RED };

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  // Trips that still hold the resource and touch today. DONE is left out
  // here: a finished trip means the vehicle or driver is already back.
  const today = trips
    .filter(
      (t) =>
        t.status !== "CANCELLED" && t.status !== "DECLINED" && t.status !== "DONE",
    )
    .map((t) => ({ start: new Date(t.time_from), end: new Date(t.time_to) }))
    .filter((t) => t.start <= dayEnd && t.end >= dayStart)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const current = today.find((t) => t.start <= now && now < t.end);
  if (current) {
    const back = isSameDay(current.end, now)
      ? format(current.end, "h:mm a")
      : format(current.end, "MMM d");
    return { label: `On trip · back ${back}`, tone: RED };
  }

  const next = today.find((t) => t.start > now);
  if (next) {
    return { label: `Booked from ${format(next.start, "h:mm a")}`, tone: AMBER };
  }

  return { label: "Available", tone: GREEN };
}

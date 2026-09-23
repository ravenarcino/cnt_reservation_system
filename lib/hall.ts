import { Prisma } from "@prisma/client";

// Server-side rules for hall bookings, shared by create (POST) and edit
// (PATCH). Until now these were only checked in the browser, so a request sent
// straight to the API could double-book a hall or book a closed day.

export class HallBookingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Local "YYYY-MM-DD" of a date - the same form non-working days are keyed by.
function localDay(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export async function assertHallBookable(
  db: Prisma.TransactionClient,
  opts: {
    hallIds: string[];
    timeFrom: Date;
    timeTo: Date;
    // The booking being edited - it must not collide with itself.
    excludeReservationId?: string;
  },
) {
  const { hallIds, timeFrom, timeTo, excludeReservationId } = opts;

  if (hallIds.length === 0) {
    throw new HallBookingError("Select at least one hall", 400);
  }
  if (Number.isNaN(timeFrom.getTime()) || Number.isNaN(timeTo.getTime())) {
    throw new HallBookingError("Enter a valid date and time", 400);
  }
  if (timeTo <= timeFrom) {
    throw new HallBookingError("End time must be after start time", 400);
  }

  // Halls must exist and not be closed by the admin.
  const halls = await db.hall.findMany({
    where: { hall_id: { in: hallIds }, deletedAt: null },
    select: { hall_id: true, hall_name: true, status: true },
  });
  if (halls.length !== hallIds.length) {
    throw new HallBookingError("One or more selected halls no longer exist", 409);
  }
  const closed = halls.filter((h) => h.status !== "OPEN");
  if (closed.length > 0) {
    throw new HallBookingError(
      `Not available: ${closed.map((h) => h.hall_name).join(", ")}`,
      409,
    );
  }

  // Hall non-working days. Stored from "YYYY-MM-DD" at UTC midnight, so the ISO
  // date part matches the booking's local calendar day.
  const day = localDay(timeFrom);
  const nwd = await db.no_Work_Days.findMany({
    where: { deletedAt: null, nwd_type: "HALL" },
    select: { date: true, description: true },
  });
  const hit = nwd.find((n) => n.date.toISOString().slice(0, 10) === day);
  if (hit) {
    throw new HallBookingError(`That date is a non-working day (${hit.description})`, 409);
  }

  // The double-booking guard: any active booking sharing a hall whose time
  // overlaps. time_from / time_to carry the date, so this is same-day only.
  const clash = await db.hallReservation.findFirst({
    where: {
      status: { notIn: ["CANCELLED", "DECLINED"] },
      deletedBySuperAdminAt: null,
      hall: { some: { hall_id: { in: hallIds } } },
      time_from: { lt: timeTo },
      time_to: { gt: timeFrom },
      ...(excludeReservationId && {
        reservation_id: { not: excludeReservationId },
      }),
    },
    include: { hall: { select: { hall_id: true, hall_name: true } } },
  });
  if (clash) {
    const taken = clash.hall
      .filter((h) => hallIds.includes(h.hall_id))
      .map((h) => h.hall_name)
      .join(", ");
    throw new HallBookingError(`Already reserved for that time: ${taken}`, 409);
  }
}

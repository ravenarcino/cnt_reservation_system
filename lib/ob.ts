import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

// Shared helpers for OB reservation routes.

// Statuses that no longer hold a vehicle. Everything else - PENDING,
// APPROVED, FOR_REVIEW, FOR_APPROVAL, DONE - still occupies its time slot.
export const INACTIVE_OB_STATUSES = ["CANCELLED", "DECLINED"] as const;

// Roles that administer OB trips: approve, decline, cancel, edit any trip.
export const OB_ADMIN_ROLES = ["SUPER_ADMIN", "IT_ADMIN", "OB_ADMIN"];

// Per-role soft-delete column on ObReservation. The hall admin has none -
// OB is not theirs to manage.
export const OB_DELETE_FIELD: Record<string, string> = {
  USER: "deletedByUserAt",
  OB_ADMIN: "deletedByObAdminAt",
  IT_ADMIN: "deletedByITAt",
  SUPER_ADMIN: "deletedBySuperAdminAt",
};

// Build a Date from "YYYY-MM-DD" + "HH:MM" in the server's local time.
// Parsing the parts explicitly avoids `new Date("YYYY-MM-DD")`, which is read
// as UTC midnight and can land on the previous day once hours are applied.
export function combineDateTime(date: string, time: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  const tm = /^(\d{2}):(\d{2})$/.exec(time ?? "");
  if (!dm || !tm) return null;

  const d = new Date(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
    0,
    0,
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Input parsing and resource checks shared by create (POST) and edit (PATCH),
// so both enforce exactly the same rules.


export class ObBookingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type ObInput = {
  purpose: string;
  destination: string;
  passengers: number;
  start: Date;
  end: Date;
  vehicleIds: string[];
  driverIds: string[];
  personalDriver: string;
  otherRequest: string | null;
  dateDeparture: string;
  dateReturn: string;
};

// Throws ObBookingError (400) on anything malformed.
export function parseObInput(body: any): ObInput {
  const purpose = String(body.purpose ?? "").trim();
  const destination = String(body.destination ?? "").trim();
  const passengers = Number(body.passengers_qty);
  const vehicleIds: string[] = Array.isArray(body.vehicle)
    ? [...new Set<string>(body.vehicle)]
    : [];
  const driverIds: string[] = Array.isArray(body.drivers)
    ? [...new Set<string>(body.drivers)]
    : [];
  const personalDriver = body.personal_driver
    ? String(body.driver_name ?? "").trim()
    : "";

  if (!purpose || !destination)
    throw new ObBookingError("Purpose and destination are required", 400);
  if (!Number.isInteger(passengers) || passengers < 1)
    throw new ObBookingError("Enter a valid number of passengers", 400);
  if (vehicleIds.length === 0)
    throw new ObBookingError("Select at least one vehicle", 400);
  if (body.personal_driver && !personalDriver)
    throw new ObBookingError("Enter the personal driver's name", 400);
  if (driverIds.length === 0 && !personalDriver)
    throw new ObBookingError("Select at least one driver", 400);

  const start = combineDateTime(body.date_departure, body.time_from);
  const end = combineDateTime(body.date_return, body.time_to);
  if (!start || !end)
    throw new ObBookingError("Enter valid departure and return dates and times", 400);
  if (end <= start) throw new ObBookingError("Return must be after departure", 400);

  return {
    purpose,
    destination,
    passengers,
    start,
    end,
    vehicleIds,
    driverIds,
    personalDriver,
    otherRequest: String(body.other_request ?? "").trim() || null,
    dateDeparture: body.date_departure,
    dateReturn: body.date_return,
  };
}

// Rejects a departure or return that falls on an OB non-working day.
export async function assertNotOnClosedDay(
  db: Prisma.TransactionClient,
  input: ObInput,
) {
  const closed = await db.no_Work_Days.findMany({
    where: { deletedAt: null, nwd_type: "OB" },
    select: { date: true, description: true },
  });
  // Stored from "YYYY-MM-DD" at UTC midnight, so the ISO date part matches.
  const byDay = new Map(
    closed.map((c) => [c.date.toISOString().slice(0, 10), c.description]),
  );
  for (const [label, day] of [
    ["Departure", input.dateDeparture],
    ["Return", input.dateReturn],
  ] as const) {
    if (byDay.has(day)) {
      throw new ObBookingError(
        `${label} date is a non-working day (${byDay.get(day)})`,
        409,
      );
    }
  }
}

// Drivers with an APPROVED day off touching [start, end]. A day off covers
// whole days: date_from 00:00 through date_to 23:59:59.
export async function driversOnDayOff(
  db: Prisma.TransactionClient,
  start: Date,
  end: Date,
  driverIds?: string[],
): Promise<string[]> {
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(end);
  dayEnd.setHours(23, 59, 59, 999);

  const rows = await db.driverDayOff.findMany({
    where: {
      status: "APPROVED",
      deletedAt: null,
      date_from: { lte: dayEnd },
      date_to: { gte: dayStart },
      ...(driverIds && { driverId: { in: driverIds } }),
    },
    select: { driverId: true },
  });
  return [...new Set(rows.map((r) => r.driverId))];
}

// Vehicles and drivers must exist, be released for use, and not be on another
// overlapping trip. `excludeObId` is the trip being edited - it must not
// collide with itself.
export async function assertResourcesFree(
  db: Prisma.TransactionClient,
  input: ObInput,
  excludeObId?: string,
) {
  const overlap = {
    status: { notIn: [...INACTIVE_OB_STATUSES] },
    deletedBySuperAdminAt: null,
    time_from: { lt: input.end },
    time_to: { gt: input.start },
    ...(excludeObId && { ob_id: { not: excludeObId } }),
  };

  const vehicles = await db.vehicle.findMany({
    where: { vehicle_id: { in: input.vehicleIds }, deletedAt: null },
    select: { vehicle_id: true, vehicle_name: true, status: true },
  });
  if (vehicles.length !== input.vehicleIds.length)
    throw new ObBookingError("One or more selected vehicles no longer exist", 409);

  const heldBack = vehicles.filter((v) => v.status !== "AVAILABLE");
  if (heldBack.length > 0)
    throw new ObBookingError(
      `Not available: ${heldBack.map((v) => v.vehicle_name).join(", ")}`,
      409,
    );

  const vehicleClash = await db.obReservation.findFirst({
    where: { ...overlap, vehicle: { some: { vehicle_id: { in: input.vehicleIds } } } },
    include: { vehicle: { select: { vehicle_id: true, vehicle_name: true } } },
  });
  if (vehicleClash) {
    const taken = vehicleClash.vehicle
      .filter((v) => input.vehicleIds.includes(v.vehicle_id))
      .map((v) => v.vehicle_name)
      .join(", ");
    throw new ObBookingError(`Already booked for that time: ${taken}`, 409);
  }

  if (input.driverIds.length > 0) {
    const drivers = await db.driver.findMany({
      where: { driver_id: { in: input.driverIds }, deletedAt: null },
      select: { driver_id: true, driver_name: true, status: true },
    });
    if (drivers.length !== input.driverIds.length)
      throw new ObBookingError("One or more selected drivers no longer exist", 409);

    const onLeave = drivers.filter((dr) => dr.status !== "AVAILABLE");
    if (onLeave.length > 0)
      throw new ObBookingError(
        `On leave: ${onLeave.map((dr) => dr.driver_name).join(", ")}`,
        409,
      );

    const offDrivers = await driversOnDayOff(db, input.start, input.end, input.driverIds);
    if (offDrivers.length > 0) {
      const names = drivers
        .filter((dr) => offDrivers.includes(dr.driver_id))
        .map((dr) => dr.driver_name)
        .join(", ");
      throw new ObBookingError(`On approved day off: ${names}`, 409);
    }

    const driverClash = await db.obReservation.findFirst({
      where: { ...overlap, drivers: { some: { driver_id: { in: input.driverIds } } } },
      include: { drivers: { select: { driver_id: true, driver_name: true } } },
    });
    if (driverClash) {
      const taken = driverClash.drivers
        .filter((dr) => input.driverIds.includes(dr.driver_id))
        .map((dr) => dr.driver_name)
        .join(", ");
      throw new ObBookingError(`Driver already assigned at that time: ${taken}`, 409);
    }
  }
}

// Shared error mapping for OB routes. Lives here, not in a route file:
// Next.js only allows HTTP handlers to be exported from route.ts.
export function obErrorResponse(error: unknown, fallback: string) {
  if (error instanceof ObBookingError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }

  // P2034: a concurrent booking won the race under Serializable isolation.
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return NextResponse.json(
      { success: false, error: "Someone booked at the same moment. Please try again." },
      { status: 409 },
    );
  }

  console.error(fallback, error);
  return NextResponse.json(
    { success: false, error: `${fallback}: ${error}` },
    { status: 500 },
  );
}

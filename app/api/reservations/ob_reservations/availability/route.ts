import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { combineDateTime, driversOnDayOff, INACTIVE_OB_STATUSES } from "@/lib/ob";

// GET /api/reservations/ob_reservations/availability
//   ?date_departure=YYYY-MM-DD&time_from=HH:MM&date_return=YYYY-MM-DD&time_to=HH:MM
//   &exclude=OB-xxxx   (optional: the trip being edited, so it does not block itself)
//
// Returns the ids of vehicles and drivers already booked in that window. A regular user's
// reservation list only holds their own trips, so the booking form cannot work
// this out from it - this endpoint looks across everyone's trips but returns
// vehicle ids only, never who booked them.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const start = combineDateTime(
    searchParams.get("date_departure") ?? "",
    searchParams.get("time_from") ?? "",
  );
  const end = combineDateTime(
    searchParams.get("date_return") ?? "",
    searchParams.get("time_to") ?? "",
  );
  const exclude = searchParams.get("exclude");

  // Incomplete window: nothing is busy yet as far as the form is concerned.
  if (!start || !end || end <= start) {
    return NextResponse.json({ busyVehicleIds: [], busyDriverIds: [] });
  }

  const overlapping = await prisma.obReservation.findMany({
    where: {
      status: { notIn: [...INACTIVE_OB_STATUSES] },
      deletedBySuperAdminAt: null,
      time_from: { lt: end },
      time_to: { gt: start },
      ...(exclude && { ob_id: { not: exclude } }),
    },
    select: {
      vehicle: { select: { vehicle_id: true } },
      drivers: { select: { driver_id: true } },
    },
  });

  const busyVehicleIds = [
    ...new Set(overlapping.flatMap((r) => r.vehicle.map((v) => v.vehicle_id))),
  ];

  // Drivers on an approved day off are just as unavailable as booked ones.
  const offDriverIds = await driversOnDayOff(prisma, start, end);

  const busyDriverIds = [
    ...new Set([
      ...overlapping.flatMap((r) => r.drivers.map((dr) => dr.driver_id)),
      ...offDriverIds,
    ]),
  ];

  return NextResponse.json({ busyVehicleIds, busyDriverIds });
}

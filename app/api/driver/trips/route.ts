import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDriverForUser } from "@/lib/driver";

// GET /api/driver/trips
// The signed-in driver's approved trips that still matter: anything ending
// today or later, plus earlier approved trips not yet marked done. Also
// returns recently finished (DONE) trips from today onward for reference.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId || session.user.systemRole !== "DRIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const driver = await getDriverForUser(session.user.userId);
  if (!driver) {
    return NextResponse.json({ driver: null, data: [] });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const trips = await prisma.obReservation.findMany({
    where: {
      drivers: { some: { driver_id: driver.driver_id } },
      deletedBySuperAdminAt: null,
      OR: [
        { status: "APPROVED" },
        { status: "DONE", time_to: { gte: todayStart } },
      ],
    },
    include: {
      vehicle: { select: { vehicle_id: true, vehicle_name: true, plate_number: true } },
      drivers: { select: { driver_id: true, driver_name: true } },
      ob_user: { select: { name: true, email: true, department: true } },
    },
    orderBy: { time_from: "asc" },
  });

  return NextResponse.json({
    driver: { driver_id: driver.driver_id, driver_name: driver.driver_name },
    data: trips,
  });
}

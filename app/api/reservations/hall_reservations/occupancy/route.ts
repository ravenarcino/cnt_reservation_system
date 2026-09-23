import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/reservations/hall_reservations/occupancy
//
// Every active hall booking from today on, across ALL users. Drives hall
// availability (a user's own list holds only their bookings) and the
// calendar's hover popup, which shows who booked, when, which hall, purpose
// and status.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const data = await prisma.hallReservation.findMany({
    where: {
      status: { notIn: ["CANCELLED", "DECLINED"] },
      deletedBySuperAdminAt: null,
      time_to: { gte: todayStart },
    },
    select: {
      reservation_id: true,
      date_appointment: true,
      time_from: true,
      time_to: true,
      status: true,
      // Shown in the calendar's hover popup. Opened up to every signed-in
      // user by decision of the system owner (names, purpose and status).
      purpose: true,
      hall: { select: { hall_id: true, hall_name: true } },
      hall_user: { select: { name: true } },
    },
  });

  return NextResponse.json({ data });
}

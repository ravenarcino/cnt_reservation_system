import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { INACTIVE_OB_STATUSES } from "@/lib/ob";

// GET /api/reservations/ob_reservations/occupancy
//
// Every active OB trip from today on, across ALL users, for the calendar's
// hover popup: who booked, when, which vehicles, where, purpose and status.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const data = await prisma.obReservation.findMany({
    where: {
      status: { notIn: [...INACTIVE_OB_STATUSES] },
      deletedBySuperAdminAt: null,
      time_to: { gte: todayStart },
    },
    select: {
      ob_id: true,
      purpose: true,
      destination: true,
      status: true,
      time_from: true,
      time_to: true,
      vehicle: { select: { vehicle_id: true, vehicle_name: true } },
      ob_user: { select: { name: true } },
    },
  });

  return NextResponse.json({ data });
}

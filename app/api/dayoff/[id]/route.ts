import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { OB_ADMIN_ROLES } from "@/lib/ob";

// Which status each admin action may be applied from.
const TRANSITIONS: Record<string, string[]> = {
  APPROVED: ["PENDING"],
  DECLINED: ["PENDING", "APPROVED"],
};

// PATCH /api/dayoff/[id]  { action: "APPROVED" | "DECLINED" }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId || !OB_ADMIN_ROLES.includes(session.user.systemRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { id } = await params;
  const { action } = await req.json();

  const existing = await prisma.driverDayOff.findUnique({ where: { dayoff_id: id } });
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
  }
  if (!(action in TRANSITIONS) || !TRANSITIONS[action].includes(existing.status)) {
    return NextResponse.json(
      { success: false, error: `A ${existing.status.toLowerCase()} request cannot be ${String(action).toLowerCase()}` },
      { status: 409 },
    );
  }

  const data = await prisma.driverDayOff.update({
    where: { dayoff_id: id },
    data: { status: action, decidedBy: session.user.userId, decidedAt: new Date() },
  });

  await writeLog({
    event_type: "UPDATED",
    event: "Update Day Off",
    changes: `Day off ${id} ${action.toLowerCase()}`,
    reservation_type: "Calendar",
    userId: session.user.userId,
  });

  // Trips this driver is already on during the day off - approving does not
  // unassign them, so the admin is told which ones need a new driver.
  let conflicts: string[] = [];
  if (action === "APPROVED") {
    const end = new Date(existing.date_to);
    end.setHours(23, 59, 59, 999);
    const trips = await prisma.obReservation.findMany({
      where: {
        drivers: { some: { driver_id: existing.driverId } },
        status: { notIn: ["CANCELLED", "DECLINED", "DONE"] },
        time_from: { lte: end },
        time_to: { gte: existing.date_from },
      },
      select: { ob_id: true },
    });
    conflicts = trips.map((t) => t.ob_id);
  }

  return NextResponse.json({ success: true, data, conflicts });
}

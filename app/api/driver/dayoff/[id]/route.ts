import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { getDriverForUser } from "@/lib/driver";

// PATCH /api/driver/dayoff/[id]  { action: "CANCELLED" }
// A driver may withdraw their own request while it is still pending.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId || session.user.systemRole !== "DRIVER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const driver = await getDriverForUser(session.user.userId);
  const { id } = await params;
  const { action } = await req.json();

  const existing = await prisma.driverDayOff.findUnique({ where: { dayoff_id: id } });
  if (!driver || !existing || existing.deletedAt || existing.driverId !== driver.driver_id) {
    return NextResponse.json({ success: false, error: "Request not found" }, { status: 404 });
  }
  if (action !== "CANCELLED" || existing.status !== "PENDING") {
    return NextResponse.json(
      { success: false, error: "Only a pending request can be cancelled" },
      { status: 409 },
    );
  }

  const data = await prisma.driverDayOff.update({
    where: { dayoff_id: id },
    data: { status: "CANCELLED" },
  });

  await writeLog({
    event_type: "UPDATED",
    event: "Cancel Day Off",
    changes: `Day off ${id} cancelled`,
    reservation_type: "Calendar",
    userId: session.user.userId,
  });

  return NextResponse.json({ success: true, data });
}

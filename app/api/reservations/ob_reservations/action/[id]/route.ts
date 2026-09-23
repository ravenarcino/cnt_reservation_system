import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { OB_ADMIN_ROLES } from "@/lib/ob";
import { getDriverForUser } from "@/lib/driver";

// Which status each action may be applied from. Mirrors the button matrix on
// the admin page, but enforced on the server so a crafted request cannot, for
// example, approve a cancelled trip.
const ADMIN_TRANSITIONS: Record<string, string[]> = {
  APPROVED: ["PENDING"],
  DECLINED: ["PENDING", "FOR_REVIEW", "FOR_APPROVAL"],
  CANCELLED: ["PENDING", "FOR_REVIEW", "FOR_APPROVAL", "APPROVED"],
};

// PATCH /api/reservations/ob_reservations/action/[id]   { action }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const user = session.user;
  const isAdmin = OB_ADMIN_ROLES.includes(user.systemRole);

  try {
    const { id } = await params;
    const { action } = await req.json();

    const existing = await prisma.obReservation.findUnique({
      where: { ob_id: id },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "OB reservation not found" },
        { status: 404 },
      );
    }

    if (action === "DONE") {
      // The traveller closes out their own trip once it has actually ended,
      // and so can a driver assigned to it.
      let isAssignedDriver = false;
      if (user.systemRole === "DRIVER") {
        const me = await getDriverForUser(user.userId);
        isAssignedDriver =
          !!me &&
          (await prisma.obReservation.count({
            where: { ob_id: id, drivers: { some: { driver_id: me.driver_id } } },
          })) > 0;
      }
      if (!isAdmin && !isAssignedDriver && existing.userId !== user.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (existing.status !== "APPROVED") {
        return NextResponse.json(
          { success: false, error: "Only an approved trip can be marked as done" },
          { status: 409 },
        );
      }
      if (existing.time_to > new Date()) {
        return NextResponse.json(
          { success: false, error: "This trip has not finished yet" },
          { status: 409 },
        );
      }
    } else if (action in ADMIN_TRANSITIONS) {
      if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (!ADMIN_TRANSITIONS[action].includes(existing.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `A ${existing.status.toLowerCase()} trip cannot be ${action.toLowerCase()}`,
          },
          { status: 409 },
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: "Unknown action" },
        { status: 400 },
      );
    }

    // No vehicle or driver status to touch: availability is worked out from
    // the trip's time window, and CANCELLED / DECLINED trips are ignored by
    // that check - so they free up on their own.
    const reservation = await prisma.obReservation.update({
      where: { ob_id: id },
      data: {
        status: action,
        notifyUser: action !== "DONE",
        ...(user.systemRole === "OB_ADMIN" && { readByObAdmin: true }),
        ...(user.systemRole === "SUPER_ADMIN" && { readBySuperAdmin: true }),
      },
    });

    const logs = await writeLog({
      event_type: "UPDATED",
      event: "Update OB Reservation Status",
      changes: `OB trip marked ${action}`,
      reservation_type: "OB",
      obReservationId: reservation.ob_id,
      userId: user.userId,
    });

    return NextResponse.json({ success: true, data: reservation, logs });
  } catch (error) {
    console.error("OB action failed:", error);
    return NextResponse.json(
      { success: false, error: `Failed to update OB reservation: ${error}` },
      { status: 500 },
    );
  }
}

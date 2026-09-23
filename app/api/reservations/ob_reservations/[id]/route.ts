import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import {
  ObBookingError,
  assertNotOnClosedDay,
  assertResourcesFree,
  OB_ADMIN_ROLES,
  OB_DELETE_FIELD,
  obErrorResponse,
  parseObInput,
} from "@/lib/ob";

// Who may edit a trip in which status. A regular user may only change a
// PENDING trip - once it is approved the details are settled. Admins may still
// correct an approved trip. Enforced here, not just by hiding the button.
const USER_EDITABLE = ["PENDING"];
const ADMIN_EDITABLE = ["PENDING", "FOR_REVIEW", "FOR_APPROVAL", "APPROVED"];

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
    const existing = await prisma.obReservation.findUnique({
      where: { ob_id: id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "OB reservation not found" },
        { status: 404 },
      );
    }

    if (!isAdmin && existing.userId !== user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const allowed = isAdmin ? ADMIN_EDITABLE : USER_EDITABLE;
    if (!allowed.includes(existing.status)) {
      throw new ObBookingError(
        existing.status === "APPROVED"
          ? "This trip is already approved and can no longer be edited"
          : "This trip can no longer be edited",
        409,
      );
    }

    if (existing.time_to < new Date()) {
      throw new ObBookingError("This trip has already ended", 409);
    }

    const input = parseObInput(await req.json());
    if (input.start < new Date()) {
      throw new ObBookingError("Departure cannot be in the past", 400);
    }

    // Vehicles and drivers are time-based: whatever is left out of `set`
    // simply stops belonging to this trip and is free again - nothing to
    // release. Only the newly chosen ones need checking.
    const reservation = await prisma.$transaction(
      async (tx) => {
        await assertNotOnClosedDay(tx, input);
        await assertResourcesFree(tx, input, id);

        return tx.obReservation.update({
          where: { ob_id: id },
          data: {
            purpose: input.purpose,
            destination: input.destination,
            passengers_qty: input.passengers,
            date_departure: input.start,
            date_return: input.end,
            time_from: input.start,
            time_to: input.end,
            driver_name: input.personalDriver || null,
            other_request: input.otherRequest,
            vehicle: { set: input.vehicleIds.map((v) => ({ vehicle_id: v })) },
            drivers: { set: input.driverIds.map((dr) => ({ driver_id: dr })) },
          },
          include: { vehicle: true, drivers: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const logs = await writeLog({
      event_type: "UPDATED",
      event: "Update OB Reservation",
      changes: `OB trip to "${reservation.destination}" updated`,
      reservation_type: "OB",
      obReservationId: reservation.ob_id,
      userId: user.userId,
    });

    return NextResponse.json({ success: true, data: reservation, logs });
  } catch (error) {
    return obErrorResponse(error, "Failed to update OB reservation");
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = session.user;

  try {
    const { id } = await params;
    const existing = await prisma.obReservation.findUnique({
      where: { ob_id: id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "OB reservation not found" },
        { status: 404 },
      );
    }

    if (user.systemRole === "USER" && existing.userId !== user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Soft delete, hidden only from the role that deleted it - same as hall.
    const field = OB_DELETE_FIELD[user.systemRole];
    if (!field) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const reservation = await prisma.obReservation.update({
      where: { ob_id: id },
      data: { [field]: new Date() },
    });

    const logs = await writeLog({
      event_type: "DELETED",
      event: "Delete OB Reservation",
      changes: `OB trip to "${reservation.destination}" deleted`,
      reservation_type: "OB",
      obReservationId: reservation.ob_id,
      userId: user.userId,
    });

    return NextResponse.json({ success: true, data: reservation, logs });
  } catch (error) {
    return obErrorResponse(error, "Failed to delete OB reservation");
  }
}

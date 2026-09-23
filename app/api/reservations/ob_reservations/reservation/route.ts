import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import {
  ObBookingError,
  assertNotOnClosedDay,
  assertResourcesFree,
  OB_DELETE_FIELD,
  obErrorResponse,
  parseObInput,
} from "@/lib/ob";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // The trip belongs to whoever is signed in - never to a body-supplied id.
  const ownerId = session.user.userId;

  try {
    const input = parseObInput(await req.json());

    if (input.start < new Date()) {
      throw new ObBookingError("Departure cannot be in the past", 400);
    }

    const reservation = await prisma.$transaction(
      async (tx) => {
        await assertNotOnClosedDay(tx, input);
        await assertResourcesFree(tx, input);

        return tx.obReservation.create({
          data: {
            ob_id: `OB-${nanoid(10)}`,
            userId: ownerId,
            purpose: input.purpose,
            destination: input.destination,
            passengers_qty: input.passengers,
            date_departure: input.start,
            date_return: input.end,
            time_from: input.start,
            time_to: input.end,
            // Only set for a personal driver; company drivers are linked below.
            driver_name: input.personalDriver || null,
            other_request: input.otherRequest,
            vehicle: { connect: input.vehicleIds.map((id) => ({ vehicle_id: id })) },
            drivers: { connect: input.driverIds.map((id) => ({ driver_id: id })) },
          },
          include: { vehicle: true, drivers: true },
        });
      },
      // Serializable makes two simultaneous bookings of the same vehicle or
      // driver conflict: one commits, the other fails instead of both slipping in.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const logs = await writeLog({
      event_type: "CREATED",
      event: "Create OB Reservation",
      changes: `OB trip to "${reservation.destination}" created`,
      reservation_type: "OB",
      obReservationId: reservation.ob_id,
      userId: ownerId,
    });

    return NextResponse.json({ success: true, data: reservation, logs });
  } catch (error) {
    return obErrorResponse(error, "Failed to create OB reservation");
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = session.user;

  // Each role hides the trips it deleted through its own column. The hall
  // admin has no column and no business with OB, so it is refused.
  const deleteField = OB_DELETE_FIELD[user.systemRole];
  if (!deleteField) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const where: Prisma.ObReservationWhereInput = {
    [deleteField]: null,
    // Regular users see only their own trips.
    ...(user.systemRole === "USER" && { userId: user.userId }),
  };

  const data = await prisma.obReservation.findMany({
    where,
    include: {
      vehicle: true,
      drivers: true,
      ob_user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ data, total: data.length });
}

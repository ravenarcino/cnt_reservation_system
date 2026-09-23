import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { HallBookingError, assertHallBookable } from "@/lib/hall";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // The reservation belongs to whoever is signed in. Taking this from the
  // request body would let anyone file a booking under someone else's name.
  const ownerId = session.user.userId;

  try {
    const body = await req.json();

    const appointmentDate = new Date(body.date_appointment);
    const [fromHours, fromMinutes] = body.time_from.split(":").map(Number);
    const [toHours, toMinutes] = body.time_to.split(":").map(Number);

    const timeFrom = new Date(appointmentDate);
    timeFrom.setHours(fromHours, fromMinutes, 0, 0);

    const timeTo = new Date(appointmentDate);
    timeTo.setHours(toHours, toMinutes, 0, 0);

    const equipmentIds: string[] = Array.isArray(body.equipment)
      ? body.equipment
      : [];

    // Creating the reservation and marking its equipment as BORROWED must
    // happen together - a half-applied write would either hand out an item
    // twice or strand it as unavailable with no reservation behind it.
    const hallIds: string[] = Array.isArray(body.hall) ? body.hall : [];

    const [reservation] = await prisma.$transaction(async (tx) => {
      // Hall rules first: open hall, not a non-working day, no overlap.
      await assertHallBookable(tx, { hallIds, timeFrom, timeTo });

      // Claim the items first. `status: "OPEN"` in the filter means an item
      // already taken by someone else is simply not updated, so a race between
      // two submissions cannot hand the same item to both.
      const claimed = await tx.equipment.updateMany({
        where: {
          item_id: { in: equipmentIds },
          status: "OPEN",
          deletedAt: null,
        },
        data: {
          status: "BORROWED",
          updatedAt: new Date(),
        },
      });

      if (claimed.count !== equipmentIds.length) {
        // Someone took at least one of these items between the form loading
        // and this submit. Abort so the whole transaction rolls back.
        throw new Error(
          "One or more of the selected items are no longer available",
        );
      }

      const created = await tx.hallReservation.create({
        data: {
          reservation_id: `RES-${nanoid(10)}`,
          userId: ownerId,
          purpose: body.purpose,
          attendees_qty: Number(body.attendees_qty),
          hall_type: body.hall_type,
          equipment: {
            connect: equipmentIds.map((id: string) => ({ item_id: id })),
          },
          hall: {
            connect: hallIds.map((id: string) => ({ hall_id: id })),
          },
          date_appointment: appointmentDate,
          time_from: timeFrom,
          time_to: timeTo,
          other_request: body.other_request,
        },
      });

      return [created];
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "CREATED",
        event: "Create Reservation",
        userId: ownerId,
        reservationId: reservation.reservation_id,
        reservation_type: "Hall",
        changes: body.changes,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: reservation,
        logs,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof HallBookingError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    // P2034: a simultaneous booking won the race under Serializable isolation.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { success: false, error: "Someone booked at the same moment. Please try again." },
        { status: 409 },
      );
    }

    // Items were claimed by someone else mid-submit. The transaction rolled
    // back, so nothing was created and no item was left marked BORROWED.
    if (
      error instanceof Error &&
      error.message.includes("no longer available")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: `Failed to create reservation: ${error}`,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = session.user;

  const where: Prisma.HallReservationWhereInput = {
    ...(user.systemRole === "USER" && {
      deletedByUserAt: null,
      userId: user.userId, // regular users only see their own
    }),
    ...(user.systemRole === "HALL_ADMIN" && { deletedByHallAdminAt: null }),
    ...(user.systemRole === "IT_ADMIN" && { deletedByITAt: null }),
    ...(!["USER", "HALL_ADMIN", "IT_ADMIN"].includes(user.systemRole) && {
      deletedBySuperAdminAt: null,
    }),
  };

  const type = await prisma.hallReservation.findMany({
    where,
    include: {
      hall: true,
      equipment: true,
      hall_user: true,
    },
    // skip: (page - 1) * limit,
    // take: limit,
    orderBy: {
      createdAt: "desc",
    },
  });

  const total = await prisma.hallReservation.count({
    where,
  });

  return Response.json({
    data: type,
    total,
  });
}

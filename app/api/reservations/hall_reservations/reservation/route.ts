import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  //   const session = await auth();
  //   if (!session || session.user?.systemRole !== "IT_ADMIN") {
  //     return Response.json({ error: "Unauthorized" }, { status: 403 });
  //   }
  try {
    const body = await req.json();

    const appointmentDate = new Date(body.date_appointment);
    const [fromHours, fromMinutes] = body.time_from.split(":").map(Number);
    const [toHours, toMinutes] = body.time_to.split(":").map(Number);

    const timeFrom = new Date(appointmentDate);
    timeFrom.setHours(fromHours, fromMinutes, 0, 0);

    const timeTo = new Date(appointmentDate);
    timeTo.setHours(toHours, toMinutes, 0, 0);

    const reservation = await prisma.hallReservation.create({
      data: {
        reservation_id: `RES-${nanoid(10)}`,
        userId: body.userId,
        purpose: body.purpose,
        attendees_qty: Number(body.attendees_qty),
        hall_type: body.hall_type,
        equipment: {
          connect: body.equipment.map((id: string) => ({ item_id: id })),
        },
        hall: {
          connect: body.hall.map((id: string) => ({ hall_id: id })),
        },
        date_appointment: appointmentDate,
        time_from: timeFrom,
        time_to: timeTo,
        other_request: body.other_request,
      },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "CREATED",
        event: "Create Reservation",
        userId: body.userId,
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
    return NextResponse.json(
      {
        success: false,
        error: `Failed to create type: ${error}`,
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

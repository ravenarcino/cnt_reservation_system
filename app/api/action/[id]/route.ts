import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = session.user;

  try {
    const { id: reservation_id } = await params;
    const body = await req.json();

    const existingReservation = await prisma.hallReservation.findUnique({
      where: { reservation_id },
    });

    if (!existingReservation) {
      return NextResponse.json(
        {
          success: false,
          error: "Reservation not found",
        },
        { status: 404 },
      );
    }

    // const appointmentDate = new Date(existingReservation.date_appointment);

    // const [fromHours, fromMinutes] = body.time_from.split(":").map(Number);
    // const [toHours, toMinutes] = body.time_to.split(":").map(Number);

    // const timeFrom = new Date(appointmentDate);
    // timeFrom.setHours(fromHours, fromMinutes, 0, 0);

    // const timeTo = new Date(appointmentDate);
    // timeTo.setHours(toHours, toMinutes, 0, 0);

    const reservation = await prisma.hallReservation.update({
      where: { reservation_id },
      data: {
        status: body.action,
        notifyUser: true,
        readByHallAdmin: true,
        updatedAt: new Date(),
      },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "UPDATED",
        event: "Update Reservation Status",
        changes: body.changes,
        userId: user.userId,
        reservationId: reservation.reservation_id,
        reservation_type: "Hall",
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
        error: `Failed to update reservation: ${error}`,
      },
      { status: 500 },
    );
  }
}

// export async function DELETE(
//   req: Request,
//   { params }: { params: Promise<{ id: string }> },
// ) {
//   const session = await getServerSession(authOptions);
//   if (!session) {
//     return Response.json({ error: "Unauthorized" }, { status: 403 });
//   }

//   const user = session.user;

//   try {
//     const { id: reservation_id } = await params;
//     const body = await req.json();

//     const existingReservation = await prisma.hallReservation.findUnique({
//       where: { reservation_id },
//     });

//     if (!existingReservation) {
//       return NextResponse.json(
//         {
//           success: false,
//           error: "Reservation not found",
//         },
//         { status: 404 },
//       );
//     }

//     const deletedField =
//       user.systemRole === "USER"
//         ? "deletedByUserAt"
//         : user.systemRole === "HALL_ADMIN"
//           ? "deletedByHallAdminAt"
//           : user.systemRole === "IT_ADMIN"
//             ? "deletedByITAt"
//             : "deletedBySuperAdminAt";

//     const reservation = await prisma.hallReservation.update({
//       where: { reservation_id },
//       data: {
//         [deletedField]: new Date(),
//       },
//     });

//     const logs = await prisma.logs.create({
//       data: {
//         log_id: `LOG-${nanoid(10)}`,
//         event_type: "DELETED",
//         event: "Delete Reservation",
//         userId: user.userId,
//         reservationId: reservation.reservation_id,
//         reservation_type: "Hall",
//         changes: body.changes,
//       },
//     });

//     return NextResponse.json(
//       {
//         success: true,
//         data: reservation,
//         logs,
//       },
//       { status: 200 },
//     );
//   } catch (error) {
//     return NextResponse.json(
//       {
//         success: false,
//         error: `Failed to delete reservation: ${error}`,
//       },
//       { status: 500 },
//     );
//   }
// }

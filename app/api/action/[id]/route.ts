import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Roles that administer hall reservations.
const HALL_ADMIN_ROLES = ["SUPER_ADMIN", "IT_ADMIN", "HALL_ADMIN"];

// Which status each admin action may be applied from - the same matrix as
// the admin page's buttons, enforced here so a crafted request cannot, for
// example, approve a cancelled booking.
const ADMIN_TRANSITIONS: Record<string, string[]> = {
  APPROVED: ["PENDING"],
  DECLINED: ["PENDING", "FOR_REVIEW", "FOR_APPROVAL"],
  CANCELLED: ["PENDING", "FOR_REVIEW", "FOR_APPROVAL", "APPROVED"],
};

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
      include: { equipment: true },
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

    const action = String(body.action ?? "");
    const isAdmin = HALL_ADMIN_ROLES.includes(user.systemRole);

    if (action === "DONE") {
      // The requester closes out their own booking once it has ended;
      // hall admins may do it for them.
      if (!isAdmin && existingReservation.userId !== user.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (existingReservation.status !== "APPROVED") {
        return NextResponse.json(
          { success: false, error: "Only an approved reservation can be marked as done" },
          { status: 409 },
        );
      }
      const end = new Date(existingReservation.date_appointment);
      const timeTo = new Date(existingReservation.time_to);
      end.setHours(timeTo.getHours(), timeTo.getMinutes(), 0, 0);
      if (end > new Date()) {
        return NextResponse.json(
          { success: false, error: "This reservation has not finished yet" },
          { status: 409 },
        );
      }
    } else if (action in ADMIN_TRANSITIONS) {
      if (!isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (!ADMIN_TRANSITIONS[action].includes(existingReservation.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `A ${existingReservation.status.toLowerCase().replace(/_/g, " ")} reservation cannot be ${action.toLowerCase()}`,
          },
          { status: 409 },
        );
      }
    } else {
      return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
    }

    // const appointmentDate = new Date(existingReservation.date_appointment);

    // const [fromHours, fromMinutes] = body.time_from.split(":").map(Number);
    // const [toHours, toMinutes] = body.time_to.split(":").map(Number);

    // const timeFrom = new Date(appointmentDate);
    // timeFrom.setHours(fromHours, fromMinutes, 0, 0);

    // const timeTo = new Date(appointmentDate);
    // timeTo.setHours(toHours, toMinutes, 0, 0);

    // DECLINED and CANCELLED end the reservation, so the equipment it was
    // holding goes back into circulation. Any other status leaves the items
    // BORROWED - an approved booking still has them.
    // Declining a cancellation request (FOR_REVIEW) rejects the request, not
    // the booking: it goes back to what it was before the request - APPROVED
    // if an admin had approved it (per the logs), otherwise PENDING.
    let newStatus = action as "APPROVED" | "DECLINED" | "CANCELLED" | "DONE" | "PENDING";
    const rejectsCancelRequest =
      action === "DECLINED" && existingReservation.status === "FOR_REVIEW";
    if (rejectsCancelRequest) {
      const approved = await prisma.logs.count({
        where: { reservationId: reservation_id, changes: { contains: "Approved" } },
      });
      newStatus = approved > 0 ? "APPROVED" : "PENDING";
    }

    const releasesEquipment =
      (action === "DECLINED" && !rejectsCancelRequest) || action === "CANCELLED";

    const heldItemIds = existingReservation.equipment.map(
      (item) => item.item_id,
    );

    const reservation = await prisma.$transaction(async (tx) => {
      const updated = await tx.hallReservation.update({
        where: { reservation_id },
        data: {
          status: newStatus,
          notifyUser: true,
          readByHallAdmin: true,
          updatedAt: new Date(),
        },
      });

      if (releasesEquipment && heldItemIds.length > 0) {
        // Only flip items that this reservation actually holds, and only the
        // ones still marked BORROWED, so a hand-edit by an admin is not undone.
        await tx.equipment.updateMany({
          where: {
            item_id: { in: heldItemIds },
            status: "BORROWED",
            deletedAt: null,
          },
          data: {
            status: "OPEN",
            updatedAt: new Date(),
          },
        });
      }

      return updated;
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

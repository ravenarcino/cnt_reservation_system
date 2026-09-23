import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { HallBookingError, assertHallBookable } from "@/lib/hall";

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

    const appointmentDate = new Date(existingReservation.date_appointment);

    const [fromHours, fromMinutes] = body.time_from.split(":").map(Number);
    const [toHours, toMinutes] = body.time_to.split(":").map(Number);

    const timeFrom = new Date(appointmentDate);
    timeFrom.setHours(fromHours, fromMinutes, 0, 0);

    const timeTo = new Date(appointmentDate);
    timeTo.setHours(toHours, toMinutes, 0, 0);

    // A regular user may edit only their own booking, and only while it is
    // PENDING - once approved the details are settled. This was only hidden in
    // the UI before, so a direct API call could still change an approved one.
    if (user.systemRole === "USER") {
      if (existingReservation.userId !== user.userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      if (existingReservation.status !== "PENDING") {
        return NextResponse.json(
          {
            success: false,
            error:
              existingReservation.status === "APPROVED"
                ? "This reservation is already approved and can no longer be edited"
                : "This reservation can no longer be edited",
          },
          { status: 409 },
        );
      }
    }

    // A finished reservation has already released its equipment. Editing one
    // would re-claim items it no longer has any right to, so refuse outright.
    if (
      existingReservation.status === "CANCELLED" ||
      existingReservation.status === "DECLINED" ||
      existingReservation.status === "DONE"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This reservation can no longer be edited",
        },
        { status: 409 },
      );
    }

    const nextItemIds: string[] = Array.isArray(body.equipment)
      ? body.equipment
      : [];
    const prevItemIds: string[] = existingReservation.equipment.map(
      (item) => item.item_id,
    );

    // What the edit actually changes about equipment. Items present in both
    // lists are left alone - they stay BORROWED by this same reservation.
    const removedItemIds = prevItemIds.filter(
      (id) => !nextItemIds.includes(id),
    );
    const addedItemIds = nextItemIds.filter((id) => !prevItemIds.includes(id));

    const hallIds: string[] = Array.isArray(body.hall) ? body.hall : [];

    const reservation = await prisma.$transaction(async (tx) => {
      // Same hall rules as a new booking, ignoring this booking's own slot.
      await assertHallBookable(tx, {
        hallIds,
        timeFrom,
        timeTo,
        excludeReservationId: reservation_id,
      });

      // Release first, so an item dropped and re-added in the same edit does
      // not fail its own claim.
      if (removedItemIds.length > 0) {
        await tx.equipment.updateMany({
          where: {
            item_id: { in: removedItemIds },
            status: "BORROWED",
            deletedAt: null,
          },
          data: {
            status: "OPEN",
            updatedAt: new Date(),
          },
        });
      }

      if (addedItemIds.length > 0) {
        // `status: "OPEN"` in the filter means an item already taken by
        // someone else simply is not updated - two concurrent edits cannot
        // both claim it.
        const claimed = await tx.equipment.updateMany({
          where: {
            item_id: { in: addedItemIds },
            status: "OPEN",
            deletedAt: null,
          },
          data: {
            status: "BORROWED",
            updatedAt: new Date(),
          },
        });

        if (claimed.count !== addedItemIds.length) {
          // Someone claimed one of these between the form loading and this
          // save. Abort so the whole edit rolls back - including the release
          // above, which must not stand on its own.
          throw new Error(
            "One or more of the selected items are no longer available",
          );
        }
      }

      return tx.hallReservation.update({
        where: { reservation_id },
        data: {
          purpose: body.purpose,
          attendees_qty: Number(body.attendees_qty),
          hall_type: body.hall_type,
          equipment: {
            set: nextItemIds.map((id: string) => ({ item_id: id })),
          },
          hall: {
            set: hallIds.map((id: string) => ({ hall_id: id })),
          },
          time_from: timeFrom,
          time_to: timeTo,
          other_request: body.other_request,
          updatedAt: new Date(),
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "UPDATED",
        event: "Update Reservation",
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
    if (error instanceof HallBookingError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { success: false, error: "Someone booked at the same moment. Please try again." },
        { status: 409 },
      );
    }
    // An item was claimed by someone else mid-edit. The transaction rolled
    // back, so nothing changed - no item was released or claimed.
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
        error: `Failed to update reservation: ${error}`,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const deletedField =
      user.systemRole === "USER"
        ? "deletedByUserAt"
        : user.systemRole === "HALL_ADMIN"
          ? "deletedByHallAdminAt"
          : user.systemRole === "IT_ADMIN"
            ? "deletedByITAt"
            : "deletedBySuperAdminAt";

    const reservation = await prisma.hallReservation.update({
      where: { reservation_id },
      data: {
        [deletedField]: new Date(),
      },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "DELETED",
        event: "Delete Reservation",
        userId: user.userId,
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
        error: `Failed to delete reservation: ${error}`,
      },
      { status: 500 },
    );
  }
}
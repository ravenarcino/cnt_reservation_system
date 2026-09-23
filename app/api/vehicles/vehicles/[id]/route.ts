import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { vehicleStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { OB_ADMIN_ROLES } from "@/lib/ob";

const STATUSES = ["AVAILABLE", "IN_USE", "MAINTENANCE"];

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  // Reading vehicles and drivers is open to every signed-in user (the booking
  // form needs it); changing them is for OB administrators only.
  if (!session?.user?.userId || !OB_ADMIN_ROLES.includes(session.user.systemRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const actorId = session.user.userId;
  const { id } = await params;

  try {
    const deletedVehicle = await prisma.vehicle.update({
      where: { vehicle_id: id },
      data: { deletedBy: actorId, deletedAt: new Date() },
    });

    const logs = await writeLog({
      event_type: "DELETED",
      event: "Delete Vehicle",
      changes: `Vehicle "${deletedVehicle.vehicle_name}" deleted`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, deletedVehicle, logs });
  } catch (error) {
    console.error("SOFT DELETE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete vehicle" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  // Reading vehicles and drivers is open to every signed-in user (the booking
  // form needs it); changing them is for OB administrators only.
  if (!session?.user?.userId || !OB_ADMIN_ROLES.includes(session.user.systemRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const actorId = session.user.userId;
  const { id } = await params;

  try {
    const body = await req.json();

    const updatedVehicle = await prisma.vehicle.update({
      where: { vehicle_id: id },
      data: {
        // Each field is only written when the request carries it, so a partial
        // update (for example just the status) leaves the rest alone.
        ...(body.name !== undefined && { vehicle_name: body.name }),
        ...(body.vehicle_brand !== undefined && {
          vehicle_brand: body.vehicle_brand || null,
        }),
        ...(body.plate_number !== undefined && {
          plate_number: body.plate_number || null,
        }),
        ...(body.capacity !== undefined && {
          capacity:
            body.capacity === "" || body.capacity === null
              ? null
              : Number(body.capacity),
        }),
        ...(body.vehicle_type !== undefined && {
          vehicle_type: body.vehicle_type,
        }),
        ...(STATUSES.includes(body.status) && {
          status: body.status as vehicleStatus,
        }),
        updatedAt: new Date(),
      },
    });

    const logs = await writeLog({
      event_type: "UPDATED",
      event: "Update Vehicle",
      changes: `Vehicle "${updatedVehicle.vehicle_name}" details updated`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, updatedVehicle, logs });
  } catch (error) {
    console.error("UPDATE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Update failed" },
      { status: 500 },
    );
  }
}

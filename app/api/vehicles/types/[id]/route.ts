import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { OB_ADMIN_ROLES } from "@/lib/ob";

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
    // Refuse to remove a type that vehicles still point at - the foreign key
    // would keep those rows referencing a deleted type.
    const inUse = await prisma.vehicle.count({
      where: { vehicle_type: id, deletedAt: null },
    });

    if (inUse > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `This type is still used by ${inUse} vehicle${inUse === 1 ? "" : "s"}. Reassign or delete them first.`,
        },
        { status: 409 },
      );
    }

    const deletedType = await prisma.vehicleType.update({
      where: { type_id: id },
      data: { deletedBy: actorId, deletedAt: new Date() },
    });

    const logs = await writeLog({
      event_type: "DELETED",
      event: "Delete Vehicle Type",
      changes: `Vehicle type "${deletedType.type}" deleted`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, deletedType, logs });
  } catch (error) {
    console.error("SOFT DELETE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete type" },
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

    const updatedType = await prisma.vehicleType.update({
      where: { type_id: id },
      data: { type: body.name, updatedAt: new Date() },
    });

    const logs = await writeLog({
      event_type: "UPDATED",
      event: "Update Vehicle Type",
      changes: `Vehicle type "${updatedType.type}" details updated`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, updatedType, logs });
  } catch (error) {
    console.error("UPDATE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Update failed" },
      { status: 500 },
    );
  }
}

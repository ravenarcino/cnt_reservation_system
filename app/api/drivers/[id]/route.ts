import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { driverStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { OB_ADMIN_ROLES } from "@/lib/ob";
import { driverAccountErrorResponse, resolveDriverAccount } from "@/lib/driver";

const STATUSES = ["AVAILABLE", "ON_LEAVE"];

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
    const userId = await resolveDriverAccount(body.userId, id);

    const driver = await prisma.driver.update({
      where: { driver_id: id },
      data: {
        ...(userId !== undefined && { userId }),
        ...(body.driver_name !== undefined && {
          driver_name: String(body.driver_name).trim(),
        }),
        ...(body.contact_number !== undefined && {
          contact_number: String(body.contact_number).trim() || null,
        }),
        ...(STATUSES.includes(body.status) && {
          status: body.status as driverStatus,
        }),
      },
    });

    const logs = await writeLog({
      event_type: "UPDATED",
      event: "Update Driver",
      changes: `Driver "${driver.driver_name}" details updated`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, data: driver, logs });
  } catch (error) {
    const accountError = driverAccountErrorResponse(error);
    if (accountError) return accountError;
    console.error("UPDATE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Update failed" },
      { status: 500 },
    );
  }
}

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
    const driver = await prisma.driver.update({
      where: { driver_id: id },
      data: { deletedAt: new Date(), deletedBy: actorId },
    });

    const logs = await writeLog({
      event_type: "DELETED",
      event: "Delete Driver",
      changes: `Driver "${driver.driver_name}" deleted`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, data: driver, logs });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete driver" },
      { status: 500 },
    );
  }
}

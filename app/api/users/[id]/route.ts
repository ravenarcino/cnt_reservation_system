import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";

const USER_ADMIN_ROLES = ["SUPER_ADMIN", "IT_ADMIN"];

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !USER_ADMIN_ROLES.includes(session.user?.systemRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  // The actor is the signed-in admin, never a value the client sends.
  const actorId = session.user.userId;

  try {
    // Soft delete the tenant
    const deletedUser = await prisma.users.update({
      where: { user_id: id },
      data: {
        deletedBy: actorId,
        deletedAt: new Date(),
      },
    });

    // writeLog is best-effort and swallows failures. That matters here: the
    // environment admin account has no Users row, so a direct logs.create
    // would hit a foreign-key error and fail an otherwise successful delete.
    const logs = await writeLog({
      event_type: "DELETED",
      event: "Delete User",
      changes: `User account "${deletedUser.name}" deleted`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, deletedUser, logs });
  } catch (error) {
    console.error("SOFT DELETE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to delete user" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !USER_ADMIN_ROLES.includes(session.user?.systemRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const actorId = session.user.userId;

  try {
    const body = await req.json();

    // Update staff basic info
    const updated = await prisma.users.update({
      where: { user_id: id },
      data: {
        name: body.name,
        email: body.email,
        department: body.department,
        role: body.role,
        systemRole: body.systemRole,
        status: body.status,
        updatedAt: new Date(),
      },
    });

    const logs = await writeLog({
      event_type: "UPDATED",
      event: "Update User Info",
      changes: `User account "${updated.name}" details updated`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({
      success: true,
      updated,
      logs,
    });
  } catch (error) {
    console.error("UPDATE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Update failed" },
      { status: 500 },
    );
  }
}
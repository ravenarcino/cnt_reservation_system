import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Soft delete user (set deletedAt and deletedBy to current date/user)
    await prisma.users.update({
      where: { user_id: session.user.userId },
      data: { 
        deletedAt: new Date(), 
        deletedBy: session.user.userId 
      },
    });

    await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "DELETED",
        event: "Delete Account",
        changes: "Deleted account",
        reservation_type: "Info",
        userId: session.user.userId,
      },
    });

    return Response.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    return Response.json({ error: "Failed to delete account" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
//   const session = await auth();
//   if (!session || session.user?.systemRole !== "IT_ADMIN") {
//     return Response.json({ error: "Unauthorized" }, { status: 403 });
//   }
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Fetch current values first so the log can record what actually changed
    const existingUser = await prisma.users.findUnique({
      where: { user_id: session.user.userId },
    });

    if (!existingUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const fieldsToCheck = ["name", "email", "department", "role"] as const;
    const changedFields = fieldsToCheck.filter(
      (field) => body[field] !== undefined && body[field] !== existingUser[field],
    );

    // Update staff basic info
    const user = await prisma.users.update({
      where: { user_id: session.user.userId },
      data: {
          name: body.name,
          email: body.email,
          department: body.department,
          role: body.role,
      },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "UPDATED",
        event: "Update Profile",
        changes: "Updated Profile information",
        reservation_type: "Info",
        userId: session.user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      user,
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
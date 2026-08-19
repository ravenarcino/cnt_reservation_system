import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
// import { auth } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // const session = await auth();
//   if (!session || session.user?.systemRole !== "IT_ADMIN") {
//     return Response.json({ error: "Unauthorized" }, { status: 403 });
//   }
  const { id } = await params;
  const body = await req.json();

  try {
    // Soft delete the tenant
    const deletedUser = await prisma.users.update({
      where: { user_id: id },
      data: {
        // deletedBy: session.user?.user_id,
        deletedBy: body.deletedBy, //for now
        deletedAt: new Date(),
      },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "DELETED",
        event: "Delete User",
        changes: `User account deleted by ${body.deletedBy ?? "unknown"}`,
        reservation_type: "Info",
        userId: id,
      },
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
//   const session = await auth();
//   if (!session || session.user?.systemRole !== "IT_ADMIN") {
//     return Response.json({ error: "Unauthorized" }, { status: 403 });
//   }
  const { id } = await params;

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

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "UPDATED",
        event: "Update User Info",
        changes: "User account details updated",
        reservation_type: "Info",
        userId: id,
      },
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
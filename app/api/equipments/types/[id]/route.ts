import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
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
    // Soft delete the type
    const deletedType = await prisma.equipmentType.update({
      where: { item_id: id },
      data: {
        // deletedBy: session.user?.user_id,
        deletedBy: body.deletedBy, //for now
        deletedAt: new Date(),
      },
    });

    const logs = await writeLog({
        event_type: "DELETED",
        event: "Delete Equipment Type",
        changes: `Equipment type "${deletedType.type}" deleted by ${body.deletedBy ?? "unknown"}`,
        reservation_type: "Info",
        userId: (await getServerSession(authOptions))?.user?.userId ?? null,
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
//   const session = await auth();
//   if (!session || session.user?.systemRole !== "IT_ADMIN") {
//     return Response.json({ error: "Unauthorized" }, { status: 403 });
//   }
  const { id } = await params;

  try {
    const body = await req.json();

    // Update staff basic info
    const updatedType = await prisma.equipmentType.update({
      where: { item_id: id },
      data: {
        type: body.name,
        updatedAt: new Date(),
      },
    });

    const logs = await writeLog({
        event_type: "UPDATED",
        event: "Update Equipment Type",
        changes: `Equipment type "${updatedType.type}" details updated`,
        reservation_type: "Info",
        userId: (await getServerSession(authOptions))?.user?.userId ?? null,
      });

    return NextResponse.json({
      success: true,
      updatedType,
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

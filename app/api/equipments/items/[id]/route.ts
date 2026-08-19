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
    // Soft delete the item
    const deletedItem = await prisma.equipment.update({
      where: { item_id: id },
      data: {
        // deletedBy: session.user?.user_id,
        deletedBy: body.deletedBy, //for now
        deletedAt: new Date(),
      },
    });

    const logs = await writeLog({
        event_type: "DELETED",
        event: "Delete Equipment Item",
        changes: `Equipment item "${deletedItem.item_name}" deleted by ${body.deletedBy ?? "unknown"}`,
        reservation_type: "Info",
        userId: (await getServerSession(authOptions))?.user?.userId ?? null,
      });

    return NextResponse.json({ success: true, deletedItem, logs });
  } catch (error) {
    console.error("SOFT DELETE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to delete item" },
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
    const updatedItem = await prisma.equipment.update({
      where: { item_id: id },
      data: {
        item_name: body.name,
        item_brand: body.item_brand,
        item_number: body.item_number,
        item_type: body.item_type,
        status: body.status,
        updatedAt: new Date(),
      },
    });

    const logs = await writeLog({
        event_type: "UPDATED",
        event: "Update Equipment Item",
        changes: `Equipment item "${updatedItem.item_name}" details updated`,
        reservation_type: "Info",
        userId: (await getServerSession(authOptions))?.user?.userId ?? null,
      });

    return NextResponse.json({
      success: true,
      updatedItem,
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

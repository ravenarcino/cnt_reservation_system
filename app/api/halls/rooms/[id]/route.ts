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
    const deletedHall = await prisma.hall.update({
      where: { hall_id: id },
      data: {
        // deletedBy: session.user?.user_id,
        deletedBy: body.deletedBy, //for now
        deletedAt: new Date(),
      },
    });

    const logs = await writeLog({
        event_type: "DELETED",
        event: "Delete Hall",
        changes: `Hall "${deletedHall.hall_name}" deleted by ${body.deletedBy ?? "unknown"}`,
        reservation_type: "Info",
        userId: (await getServerSession(authOptions))?.user?.userId ?? null,
      });

    return NextResponse.json({ success: true, deletedHall, logs });
  } catch (error) {
    console.error("SOFT DELETE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to delete hall" },
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
    const updatedHall = await prisma.hall.update({
      where: { hall_id: id },
      data: {
        hall_name: body.name,
        floor: body.floor,
        status: body.status,
        updatedAt: new Date(),
      },
    });

    const logs = await writeLog({
        event_type: "UPDATED",
        event: "Update Hall",
        changes: `Hall "${updatedHall.hall_name}" details updated`,
        reservation_type: "Info",
        userId: (await getServerSession(authOptions))?.user?.userId ?? null,
      });

    return NextResponse.json({
      success: true,
      updatedHall,
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

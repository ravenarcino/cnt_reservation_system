import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { noworkdayType } from "@prisma/client";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = session.user;
  const { id } = await params;

  try {
    // Soft delete the non-working day
    const deletedNwd = await prisma.no_Work_Days.update({
      where: { nwd_id: id },
      data: {
        deletedAt: new Date(),
      },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "DELETED",
        event: "Delete Non-Working Day",
        changes: `Non-working day "${deletedNwd.description}" (${deletedNwd.type}) deleted`,
        reservation_type: "Calendar",
        userId: user.userId,
      },
    });

    return NextResponse.json({ success: true, deletedNwd, logs });
  } catch (error) {
    console.error("SOFT DELETE ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to delete non-working day" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = session.user;
  const { id } = await params;

  try {
    const body = await req.json();

    // Only CUSTOM and HOLIDAY are allowed for now (no DAYOFF yet)
    const isValidType = body.type === "CUSTOM" || body.type === "HOLIDAY";

    if (!body.date || !body.description || !isValidType) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Date, description and a valid type (CUSTOM or HOLIDAY) are required",
        },
        { status: 400 },
      );
    }

    const updatedNwd = await prisma.no_Work_Days.update({
      where: { nwd_id: id },
      data: {
        date: new Date(body.date),
        description: body.description,
        type: body.type as noworkdayType,
        updatedAt: new Date(),
      },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "UPDATED",
        event: "Update Non-Working Day",
        changes: `Non-working day "${updatedNwd.description}" (${updatedNwd.type}) updated`,
        reservation_type: "Calendar",
        userId: user.userId,
      },
    });

    return NextResponse.json({
      success: true,
      updatedNwd,
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

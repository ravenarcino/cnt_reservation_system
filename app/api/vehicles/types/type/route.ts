import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { OB_ADMIN_ROLES } from "@/lib/ob";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  // Reading vehicles and drivers is open to every signed-in user (the booking
  // form needs it); changing them is for OB administrators only.
  if (!session?.user?.userId || !OB_ADMIN_ROLES.includes(session.user.systemRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const actorId = session.user.userId;

  try {
    const body = await req.json();

    if (!body.name?.trim()) {
      return NextResponse.json(
        { success: false, error: "Type name is required" },
        { status: 400 },
      );
    }

    const type = await prisma.vehicleType.create({
      data: {
        type_id: `VTYP-${nanoid(10)}`,
        type: body.name.trim(),
      },
    });

    const logs = await writeLog({
      event_type: "CREATED",
      event: "Create Vehicle Type",
      changes: `Vehicle type "${type.type}" created`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, data: type, logs }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to create type: ${error}` },
      { status: 500 },
    );
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const where: Prisma.VehicleTypeWhereInput = { deletedAt: null };

  const type = await prisma.vehicleType.findMany({
    where,
    orderBy: { createdAt: "asc" },
    // Counted on the server across ALL vehicles. Counting on the client from
    // the vehicle table only saw the current page (10 rows), and whatever
    // filter was active - so the cards showed wrong numbers.
    include: {
      _count: {
        select: { vehicles: { where: { deletedAt: null } } },
      },
    },
  });

  const total = await prisma.vehicleType.count({ where });

  return Response.json({ data: type, total });
}

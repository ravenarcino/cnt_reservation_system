import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma, vehicleStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { OB_ADMIN_ROLES } from "@/lib/ob";

const STATUSES = ["AVAILABLE", "IN_USE", "MAINTENANCE"];

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

    if (!body.name?.trim() || !body.vehicle_type?.trim()) {
      return NextResponse.json(
        { success: false, error: "Vehicle name and type are required" },
        { status: 400 },
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        vehicle_id: `VHC-${nanoid(10)}`,
        vehicle_name: body.name.trim(),
        vehicle_brand: body.vehicle_brand || null,
        plate_number: body.plate_number || null,
        // An empty capacity field arrives as "" - store null rather than 0.
        capacity:
          body.capacity === "" || body.capacity === undefined
            ? null
            : Number(body.capacity),
        vehicle_type: body.vehicle_type,
        status: STATUSES.includes(body.status)
          ? (body.status as vehicleStatus)
          : "AVAILABLE",
      },
    });

    const logs = await writeLog({
      event_type: "CREATED",
      event: "Create Vehicle",
      changes: `Vehicle "${vehicle.vehicle_name}" created`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, data: vehicle, logs }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to create vehicle: ${error}` },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 10);
  const search = searchParams.get("search") || "";
  const vehicleType = searchParams.get("vehicle_type");
  const status = searchParams.get("status");
  const isValidStatus = status !== null && STATUSES.includes(status);

  const where: Prisma.VehicleWhereInput = {
    deletedAt: null,
    ...(vehicleType && { vehicle_type: vehicleType }),
    ...(isValidStatus && { status: status as vehicleStatus }),
  };

  if (search) {
    where.OR = [
      { vehicle_id: { contains: search, mode: "insensitive" } },
      { vehicle_name: { contains: search, mode: "insensitive" } },
      { vehicle_brand: { contains: search, mode: "insensitive" } },
      { plate_number: { contains: search, mode: "insensitive" } },
    ];
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const total = await prisma.vehicle.count({ where });

  return Response.json({ data: vehicles, total });
}

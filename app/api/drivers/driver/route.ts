import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma, driverStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { OB_ADMIN_ROLES } from "@/lib/ob";
import { driverAccountErrorResponse, resolveDriverAccount } from "@/lib/driver";

const STATUSES = ["AVAILABLE", "ON_LEAVE"];

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
    const name = String(body.driver_name ?? "").trim();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Driver name is required" },
        { status: 400 },
      );
    }

    const userId = await resolveDriverAccount(body.userId);

    const driver = await prisma.driver.create({
      data: {
        userId: userId ?? null,
        driver_id: `DRV-${nanoid(10)}`,
        driver_name: name,
        contact_number: String(body.contact_number ?? "").trim() || null,
        status: STATUSES.includes(body.status)
          ? (body.status as driverStatus)
          : "AVAILABLE",
      },
    });

    const logs = await writeLog({
      event_type: "CREATED",
      event: "Create Driver",
      changes: `Driver "${driver.driver_name}" created`,
      reservation_type: "Info",
      userId: actorId,
    });

    return NextResponse.json({ success: true, data: driver, logs });
  } catch (error) {
    const accountError = driverAccountErrorResponse(error);
    if (accountError) return accountError;
    return NextResponse.json(
      { success: false, error: `Failed to create driver: ${error}` },
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
  const status = searchParams.get("status");

  const where: Prisma.DriverWhereInput = {
    deletedAt: null,
    ...(status && STATUSES.includes(status) && {
      status: status as driverStatus,
    }),
  };

  if (search) {
    where.OR = [
      { driver_id: { contains: search, mode: "insensitive" } },
      { driver_name: { contains: search, mode: "insensitive" } },
      { contact_number: { contains: search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.driver.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { user_id: true, name: true, email: true } } },
    }),
    prisma.driver.count({ where }),
  ]);

  return Response.json({ data, total });
}

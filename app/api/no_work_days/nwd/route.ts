import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { noworkdayType } from "@prisma/client";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = session.user;

  try {
    const body = await req.json();

    // Only CUSTOM and HOLIDAY are allowed for now (no DAYOFF yet)
    const isValidType = body.type === "CUSTOM" || body.type === "HOLIDAY";

    if (!body.date || !body.description || !isValidType) {
      return NextResponse.json(
        {
          success: false,
          error: "Date, description and a valid type (CUSTOM or HOLIDAY) are required",
        },
        { status: 400 },
      );
    }

    const noWorkDay = await prisma.no_Work_Days.create({
      data: {
        nwd_id: `NWD-${nanoid(10)}`,
        date: new Date(body.date),
        description: body.description,
        type: body.type as noworkdayType,
        userId: user.userId,
      },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "CREATED",
        event: "Create Non-Working Day",
        changes: `Non-working day "${noWorkDay.description}" (${noWorkDay.type}) added`,
        reservation_type: "Calendar",
        userId: user.userId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: noWorkDay,
        logs,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to create non-working day: ${error}`,
      },
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
  const type = searchParams.get("type");
  const isValidType = type === "CUSTOM" || type === "HOLIDAY";

  let where: Prisma.No_Work_DaysWhereInput = {
    deletedAt: null,
    ...(isValidType && { type: type as noworkdayType }),
  };

  if (search) {
    const or: Prisma.No_Work_DaysWhereInput[] = [
      { nwd_id: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];

    // Also match by type (e.g. "holiday", "custom")
    const upper = search.toUpperCase();
    if ("CUSTOM".includes(upper)) or.push({ type: "CUSTOM" });
    if ("HOLIDAY".includes(upper)) or.push({ type: "HOLIDAY" });

    where.OR = or;
  }

  const noWorkDays = await prisma.no_Work_Days.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      date: "asc",
    },
  });

  const total = await prisma.no_Work_Days.count({
    where,
  });

  return Response.json({
    data: noWorkDays,
    total,
  });
}

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { itemStatus, Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
// import { auth } from "@/lib/auth";
import { userSystemRole } from "@prisma/client";
import { hallStatus } from "@prisma/client";

export async function POST(req: Request) {
  //   const session = await auth();
  //   if (!session || session.user?.systemRole !== "IT_ADMIN") {
  //     return Response.json({ error: "Unauthorized" }, { status: 403 });
  //   }
  try {
    const body = await req.json();

    const hall = await prisma.hall.create({
      data: {
        hall_id: `RM-${nanoid(10)}`,
        hall_name: body.name,
        floor: body.floor,
        status: body.status,
      },
    });

    const logs = await writeLog({
        event_type: "CREATED",
        event: "Create Hall",
        changes: `Hall "${hall.hall_name}" created`,
        reservation_type: "Info",
        userId: (await getServerSession(authOptions))?.user?.userId ?? null,
      });

    return NextResponse.json(
      {
        success: true,
        data: hall,
        logs,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to create hall: ${error}`,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  //   const session = await auth();
  //   if (!session || session.user?.systemRole !== "IT_ADMIN") {
  //     return Response.json({ error: "Unauthorized" }, { status: 403 });
  //   }
  const { searchParams } = new URL(req.url);

  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 10);
  // const systemRole = searchParams.get("systemRole");
  const search = searchParams.get("search") || "";
  // const itemType = searchParams.get("item_type");
  const status = searchParams.get("status");
  const isValidStatus = status === "OPEN" || status === "FULL";

  let where: Prisma.HallWhereInput = {
    deletedAt: null,
    // ...(itemType && { item_type: itemType }),
    ...(isValidStatus && { status: status as hallStatus }),
    // ...(systemRole && { systemRole: systemRole as userSystemRole }),
  };

  if (search) {
    where.OR = [
      { hall_id: { contains: search, mode: "insensitive" } },
      { hall_name: { contains: search, mode: "insensitive" } },
      { floor: { contains: search, mode: "insensitive" } },
    ];
  }

  const hall = await prisma.hall.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      createdAt: "desc",
    },
  });

  const total = await prisma.hall.count({
    where,
  });

  return Response.json({
    data: hall,
    total,
  });
}

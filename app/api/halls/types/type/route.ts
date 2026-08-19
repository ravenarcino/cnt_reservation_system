import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
// import { auth } from "@/lib/auth";
import { userSystemRole } from "@prisma/client";

export async function POST(req: Request) {
//   const session = await auth();
//   if (!session || session.user?.systemRole !== "IT_ADMIN") {
//     return Response.json({ error: "Unauthorized" }, { status: 403 });
//   }
  try {
    const body = await req.json();

    const type = await prisma.hallType.create({
      data: {
        type_id: `TYP-${nanoid(10)}`,
        type: body.name,
      },
    });

    const logs = await writeLog({
        event_type: "CREATED",
        event: "Create Hall Type",
        changes: `Hall type "${type.type}" created`,
        reservation_type: "Info",
        userId: (await getServerSession(authOptions))?.user?.userId ?? null,
      });

    return NextResponse.json(
      {
        success: true,
        data: type,
        logs,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to create type: ${error}`,
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
  // const { searchParams } = new URL(req.url);

  let where: Prisma.HallTypeWhereInput = {
    deletedAt: null,
    // ...(systemRole && { systemRole: systemRole as userSystemRole }),
  };

  const type = await prisma.hallType.findMany({
    where,
    // skip: (page - 1) * limit,
    // take: limit,
    orderBy: {
      createdAt: "asc",
    },
  });

  const total = await prisma.hallType.count({
    where,
  });

  return Response.json({
    data: type,
    total
  });
}

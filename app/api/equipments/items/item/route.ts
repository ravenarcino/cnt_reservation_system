import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
// import { auth } from "@/lib/auth";
import { userSystemRole } from "@prisma/client";
import { itemStatus } from "@prisma/client";

export async function POST(req: Request) {
//   const session = await auth();
//   if (!session || session.user?.systemRole !== "IT_ADMIN") {
//     return Response.json({ error: "Unauthorized" }, { status: 403 });
//   }
  try {
    const body = await req.json();

    const item = await prisma.equipment.create({
      data: {
        item_id: `ITM-${nanoid(10)}`,
        item_name: body.name,
        item_brand: body.item_brand,
        item_number: body.item_number,
        item_type: body.item_type,
        status: body.status,
      },
    });

    const logs = await writeLog({
        event_type: "CREATED",
        event: "Create Equipment Item",
        changes: `Equipment item "${item.item_name}" created`,
        reservation_type: "Info",
        userId: (await getServerSession(authOptions))?.user?.userId ?? null,
      });

    return NextResponse.json(
      {
        success: true,
        data: item,
        logs,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to create item: ${error}`,
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
  const itemType = searchParams.get("item_type");
  const status = searchParams.get("status");
  const isValidStatus = status === "OPEN" || status === "BORROWED";

  let where: Prisma.EquipmentWhereInput = {
    deletedAt: null,
    ...(itemType && { item_type: itemType }),
    ...(isValidStatus && { status: status as itemStatus }),
    // ...(systemRole && { systemRole: systemRole as userSystemRole }),
  };

  if (search) {
    where.OR = [
      { item_id: { contains: search, mode: "insensitive" } },
      { item_name: { contains: search, mode: "insensitive" } },
      { item_brand: { contains: search, mode: "insensitive" } },
      { item_number: { contains: search, mode: "insensitive" } },
    ];
  }

  const item = await prisma.equipment.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      createdAt: "desc",
    },
  });

  const total = await prisma.equipment.count({
    where,
  });

  return Response.json({
    data: item,
    total
  });
}

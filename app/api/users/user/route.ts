import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
// import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { userSystemRole } from "@prisma/client";

export async function POST(req: Request) {
  //   const session = await auth();
  //   if (!session || session.user?.systemRole !== "IT_ADMIN") {
  //     return Response.json({ error: "Unauthorized" }, { status: 403 });
  //   }
  try {
    const body = await req.json();

    const user = await prisma.users.create({
      data: {
        user_id: `UID-${nanoid(10)}`,
        name: body.name,
        email: body.email,
        department: body.department,
        role: body.role,
        password: await bcrypt.hash(body.password, 10),
        systemRole: body.systemRole,
        status: body.status,
      },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "CREATED",
        event: "Create User",
        changes: `User account "${user.name}" created`,
        reservation_type: "Info",
        userId: user.user_id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: user,
        logs,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to create user: ${error}`,
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
  const department = searchParams.get("department") || "";
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const systemRole = searchParams.get("systemRole") || "";

  const where: Prisma.UsersWhereInput = {
    deletedAt: null,
    // ...(systemRole && { systemRole: systemRole as userSystemRole }),
  };

  if (search) {
    where.OR = [
      { user_id: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status && status !== "all") {
    where.status = status as any;
  }

  if (systemRole && systemRole !== "all") {
    where.systemRole = systemRole as any;
  }

  if (department && department !== "all") {
    where.department = department as any;
  }

  const user = await prisma.users.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: {
      createdAt: "desc",
    },
  });

  const total = await prisma.users.count({
    where,
  });

  return Response.json({
    data: user,
    total,
  });
}

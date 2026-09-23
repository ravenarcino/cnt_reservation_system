import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";

// Roles allowed to administer user accounts. IT_ADMIN is included because the
// environment admin account signs in with that role and is not a DB record.
const USER_ADMIN_ROLES = ["SUPER_ADMIN", "IT_ADMIN"];
import bcrypt from "bcryptjs";
import { userSystemRole } from "@prisma/client";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !USER_ADMIN_ROLES.includes(session.user?.systemRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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

    // Logged against the admin who performed the creation, not against the
    // account that was just created - otherwise the record reads as though the
    // new user created themselves.
    const logs = await writeLog({
      event_type: "CREATED",
      event: "Create User",
      changes: `User account "${user.name}" created`,
      reservation_type: "Info",
      userId: session.user.userId,
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
  // Read-only listing. The hall admin dashboard shows a user count from this,
  // so it stays open to any signed-in user rather than admins only.
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

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

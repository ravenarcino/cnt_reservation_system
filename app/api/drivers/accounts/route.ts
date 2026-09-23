import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { OB_ADMIN_ROLES } from "@/lib/ob";

// GET /api/drivers/accounts
// Login accounts with the DRIVER system role, for linking to a driver record.
// `linkedTo` is the driver_id already using the account, if any.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId || !OB_ADMIN_ROLES.includes(session.user.systemRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await prisma.users.findMany({
    where: { systemRole: "DRIVER", deletedAt: null },
    select: {
      user_id: true,
      name: true,
      email: true,
      driver: { select: { driver_id: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    data: users.map((u) => ({
      user_id: u.user_id,
      name: u.name,
      email: u.email,
      linkedTo: u.driver?.driver_id ?? null,
    })),
  });
}

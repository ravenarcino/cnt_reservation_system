import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { OB_ADMIN_ROLES } from "@/lib/ob";

// GET /api/dayoff?status=PENDING - every driver's day-off requests (OB admins).
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId || !OB_ADMIN_ROLES.includes(session.user.systemRole)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const status = new URL(req.url).searchParams.get("status");
  const data = await prisma.driverDayOff.findMany({
    where: {
      deletedAt: null,
      ...(status && ["PENDING", "APPROVED", "DECLINED", "CANCELLED"].includes(status) && {
        status: status as "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED",
      }),
    },
    include: { driver: { select: { driver_id: true, driver_name: true } } },
    orderBy: [{ status: "asc" }, { date_from: "asc" }],
  });

  return NextResponse.json({ data });
}

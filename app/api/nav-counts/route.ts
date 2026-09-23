import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/nav-counts
// Pending counts for the sidebar badges, scoped to what the role manages.
// Regular users and drivers get zeros - their menus show no badges.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const role = session.user.systemRole;
  const hallAdmin = ["SUPER_ADMIN", "IT_ADMIN", "HALL_ADMIN"].includes(role);
  const obAdmin = ["SUPER_ADMIN", "IT_ADMIN", "OB_ADMIN"].includes(role);
  const waiting = { in: ["PENDING", "FOR_APPROVAL", "FOR_REVIEW"] } as const;

  const [hall, ob, dayoff] = await Promise.all([
    hallAdmin
      ? prisma.hallReservation.count({
          where: { status: { in: [...waiting.in] }, deletedBySuperAdminAt: null },
        })
      : 0,
    obAdmin
      ? prisma.obReservation.count({
          where: { status: { in: [...waiting.in] }, deletedBySuperAdminAt: null },
        })
      : 0,
    obAdmin
      ? prisma.driverDayOff.count({ where: { status: "PENDING", deletedAt: null } })
      : 0,
  ]);

  return NextResponse.json({ hall, ob, dayoff });
}

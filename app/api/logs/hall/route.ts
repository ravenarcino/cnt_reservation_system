import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/logs/hall
// Returns hall-reservation activity logs for the currently signed-in user only.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = session.user;

  try {
    const logs = await prisma.logs.findMany({
      where: {
        userId: user.userId,
        OR: [
          { reservation_type: "Hall" },
          { reservation_type: "Info" },
          { reservation_type: "Calendar" },
        ],
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        success: true,
        data: logs,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch activity logs: ${error}`,
      },
      { status: 500 },
    );
  }
}

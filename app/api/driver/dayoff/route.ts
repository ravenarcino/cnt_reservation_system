import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { getDriverForUser } from "@/lib/driver";

// Parse "YYYY-MM-DD" as a local date at midnight.
function parseDay(value: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function currentDriver() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId || session.user.systemRole !== "DRIVER") return null;
  const driver = await getDriverForUser(session.user.userId);
  return driver ? { driver, userId: session.user.userId } : null;
}

// GET /api/driver/dayoff - the signed-in driver's own requests.
export async function GET() {
  const me = await currentDriver();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const data = await prisma.driverDayOff.findMany({
    where: { driverId: me.driver.driver_id, deletedAt: null },
    orderBy: { date_from: "desc" },
  });
  return NextResponse.json({ data });
}

// POST /api/driver/dayoff  { date_from, date_to, reason }
export async function POST(req: Request) {
  const me = await currentDriver();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  const from = parseDay(body.date_from);
  const to = parseDay(body.date_to ?? body.date_from);
  const reason = String(body.reason ?? "").trim();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!from || !to) return bad("Select a valid date");
  if (to < from) return bad("End date must be on or after the start date");
  if (from < today) return bad("A day off cannot start in the past");
  if (!reason) return bad("Enter a reason");

  // One live request per day: no overlap with a pending or approved one.
  const clash = await prisma.driverDayOff.findFirst({
    where: {
      driverId: me.driver.driver_id,
      deletedAt: null,
      status: { in: ["PENDING", "APPROVED"] },
      date_from: { lte: to },
      date_to: { gte: from },
    },
  });
  if (clash) return bad("You already have a day-off request covering those dates", 409);

  const dayoff = await prisma.driverDayOff.create({
    data: {
      dayoff_id: `DO-${nanoid(10)}`,
      driverId: me.driver.driver_id,
      date_from: from,
      date_to: to,
      reason,
    },
  });

  await writeLog({
    event_type: "CREATED",
    event: "File Day Off",
    changes: `Day off ${body.date_from} to ${body.date_to ?? body.date_from} filed`,
    reservation_type: "Calendar",
    userId: me.userId,
  });

  return NextResponse.json({ success: true, data: dayoff });
}

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

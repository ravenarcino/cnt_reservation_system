import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD
// Admin-wide aggregated data for the Reports page.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Optional calendar scope. The hall admin only deals with hall closures, so
  // its pages ask for HALL and never see OB entries in the count. Omitting it
  // returns every calendar, which is what the super admin wants.
  const nwdType = searchParams.get("nwd_type");
  const isValidNwdType = nwdType === "HALL" || nwdType === "OB";

  // Build an inclusive date range filter. `to` is pushed to end-of-day.
  const start = from ? new Date(from) : null;
  const end = to ? new Date(to) : null;
  if (end) end.setHours(23, 59, 59, 999);

  const rangeFor = (field: string) => {
    if (!start && !end) return {};
    return {
      [field]: {
        ...(start && { gte: start }),
        ...(end && { lte: end }),
      },
    };
  };

  try {
    // Reservations — scope out super-admin-deleted ones, filter by appointment date
    const reservations = await prisma.hallReservation.findMany({
      where: {
        deletedBySuperAdminAt: null,
        ...(rangeFor("date_appointment") as Prisma.HallReservationWhereInput),
      },
      include: {
        hall: true,
        equipment: true,
        hall_user: true,
      },
      orderBy: { date_appointment: "desc" },
    });

    // OB trips - scoped out super-admin-deleted ones, filtered by departure.
    const obReservations = await prisma.obReservation.findMany({
      where: {
        deletedBySuperAdminAt: null,
        ...(rangeFor("time_from") as Prisma.ObReservationWhereInput),
      },
      include: {
        vehicle: { select: { vehicle_id: true, vehicle_name: true } },
        drivers: { select: { driver_id: true, driver_name: true } },
        ob_user: { select: { name: true } },
      },
      orderBy: { time_from: "desc" },
    });

    // Logs — all users, filter by createdAt
    const logs = await prisma.logs.findMany({
      where: {
        deletedAt: null,
        ...(rangeFor("createdAt") as Prisma.LogsWhereInput),
      },
      orderBy: { createdAt: "desc" },
    });

    // Non-working days — filter by date
    const nonWorkingDays = await prisma.no_Work_Days.findMany({
      where: {
        deletedAt: null,
        ...(isValidNwdType && { nwd_type: nwdType as "HALL" | "OB" }),
        ...(rangeFor("date") as Prisma.No_Work_DaysWhereInput),
      },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          reservations,
          obReservations,
          logs,
          nonWorkingDays,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to build report: ${error}`,
      },
      { status: 500 },
    );
  }
}

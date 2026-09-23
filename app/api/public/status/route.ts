import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/public/status  { reference, email }
// Public reservation status lookup for the landing page. Both the reference
// number and the requester's email must match, and the same "not found"
// answer is given whether the reference is wrong or the email is - so the
// endpoint cannot be used to probe whose reservation is whose. Only a few
// non-sensitive fields are returned.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const reference = String(body.reference ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();

  if (!reference || !email) {
    return NextResponse.json(
      { success: false, error: "Enter your reference number and email" },
      { status: 400 },
    );
  }

  const notFound = NextResponse.json(
    { success: false, error: "No reservation matches that reference number and email" },
    { status: 404 },
  );

  const hall = await prisma.hallReservation.findUnique({
    where: { reservation_id: reference },
    include: {
      hall: { select: { hall_name: true } },
      hall_user: { select: { email: true } },
    },
  });
  if (hall) {
    if (hall.deletedBySuperAdminAt || hall.hall_user?.email?.toLowerCase() !== email) return notFound;
    return NextResponse.json({
      success: true,
      data: {
        type: "Hall",
        reference: hall.reservation_id,
        status: hall.status,
        purpose: hall.purpose,
        where: hall.hall.map((h) => h.hall_name).join(", "),
        date_from: hall.time_from,
        date_to: hall.time_to,
        date_appointment: hall.date_appointment,
        updatedAt: hall.updatedAt,
      },
    });
  }

  const ob = await prisma.obReservation.findUnique({
    where: { ob_id: reference },
    include: { ob_user: { select: { email: true } } },
  });
  if (ob) {
    if (ob.deletedBySuperAdminAt || ob.ob_user?.email?.toLowerCase() !== email) return notFound;
    return NextResponse.json({
      success: true,
      data: {
        type: "OB Trip",
        reference: ob.ob_id,
        status: ob.status,
        purpose: ob.purpose,
        where: ob.destination,
        date_from: ob.time_from,
        date_to: ob.time_to,
        date_appointment: null,
        updatedAt: ob.updatedAt,
      },
    });
  }

  return notFound;
}

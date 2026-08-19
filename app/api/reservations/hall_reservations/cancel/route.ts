import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// POST /api/reservations/hall_reservations/cancel
// Expects multipart/form-data with: reservation_id, reason, proof (file)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = session.user;

  try {
    const formData = await req.formData();

    const reservation_id = formData.get("reservation_id");
    const reason = formData.get("reason");
    const proof = formData.get("proof");

    if (!reservation_id || typeof reservation_id !== "string") {
      return NextResponse.json(
        { success: false, error: "Reservation ID is required" },
        { status: 400 },
      );
    }

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: "Reason is required" },
        { status: 400 },
      );
    }

    if (!proof || !(proof instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Proof file is required" },
        { status: 400 },
      );
    }

    const existingReservation = await prisma.hallReservation.findUnique({
      where: { reservation_id },
      include: { cancellation: true },
    });

    if (!existingReservation) {
      return NextResponse.json(
        { success: false, error: "Reservation not found" },
        { status: 404 },
      );
    }

    // block cancellation if already cancelled/declined, already has a
    // cancellation record, or the appointment's end time has passed
    if (
      existingReservation.status === "CANCELLED" ||
      existingReservation.status === "DECLINED" ||
      existingReservation.cancellation
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This reservation can no longer be cancelled",
        },
        { status: 409 },
      );
    }

    const appointmentEnd = new Date(existingReservation.date_appointment);
    const timeTo = new Date(existingReservation.time_to);
    appointmentEnd.setHours(timeTo.getHours(), timeTo.getMinutes(), 0, 0);

    if (new Date() >= appointmentEnd) {
      return NextResponse.json(
        {
          success: false,
          error: "This reservation can no longer be cancelled",
        },
        { status: 409 },
      );
    }

    // save the proof file to the root-level /uploads/cancellations folder
    // (sits alongside /app, /components, /public — not served statically
    // since it's outside /public)
    const uploadDir = path.join(process.cwd(), "uploads", "cancellations");
    await mkdir(uploadDir, { recursive: true });

    const fileExt = path.extname(proof.name) || "";
    const storedFileName = `CANCEL-${nanoid(10)}${fileExt}`;
    const filePath = path.join(uploadDir, storedFileName);

    const bytes = await proof.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const relativePath = `/uploads/cancellations/${storedFileName}`;

    const [reservation, cancellation] = await prisma.$transaction([
      prisma.hallReservation.update({
        where: { reservation_id },
        data: {
          status: "FOR_REVIEW",
          updatedAt: new Date(),
        },
      }),
      prisma.hallCancellation.create({
        data: {
          cancellation_id: `CANCEL-${nanoid(10)}`,
          reason: reason.trim(),
          file_name: proof.name,
          path: relativePath,
          reservationId: reservation_id,
        },
      }),
    ]);

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "CANCELLED",
        event: "Cancel Reservation",
        changes: `Reservation cancelled. Reason: ${reason.trim()}`,
        userId: user.userId,
        reservationId: reservation.reservation_id,
        reservation_type: "Hall",
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: reservation,
        cancellation,
        logs,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to cancel reservation: ${error}`,
      },
      { status: 500 },
    );
  }
}

// GET /api/reservations/hall_reservations/cancel?reservation_id=xxx
// Returns the cancellation record (and parent reservation) for a given reservation_id.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const reservation_id = searchParams.get("reservation_id");

    if (!reservation_id) {
      return NextResponse.json(
        { success: false, error: "reservation_id is required" },
        { status: 400 },
      );
    }

    const reservation = await prisma.hallReservation.findUnique({
      where: { reservation_id },
      include: { cancellation: true },
    });

    if (!reservation) {
      return NextResponse.json(
        { success: false, error: "Reservation not found" },
        { status: 404 },
      );
    }

    if (!reservation.cancellation) {
      return NextResponse.json(
        { success: false, error: "No cancellation found for this reservation" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: reservation,
        cancellation: reservation.cancellation,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to fetch cancellation: ${error}` },
      { status: 500 },
    );
  }
}

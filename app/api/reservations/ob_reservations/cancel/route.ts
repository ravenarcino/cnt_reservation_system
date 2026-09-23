import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { writeLog } from "@/lib/logger";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// POST /api/reservations/ob_reservations/cancel
// multipart/form-data: ob_id, reason, proof (file)
// Files a cancellation request. The trip moves to FOR_REVIEW; an admin then
// cancels it (freeing its vehicles and drivers) or declines the request.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const user = session.user;

  try {
    const formData = await req.formData();
    const obId = formData.get("ob_id");
    const reason = formData.get("reason");
    const proof = formData.get("proof");

    if (!obId || typeof obId !== "string") {
      return NextResponse.json(
        { success: false, error: "OB reservation ID is required" },
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

    const existing = await prisma.obReservation.findUnique({
      where: { ob_id: obId },
      include: { cancellation: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "OB reservation not found" },
        { status: 404 },
      );
    }

    if (user.systemRole === "USER" && existing.userId !== user.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (
      existing.status === "CANCELLED" ||
      existing.status === "DECLINED" ||
      existing.status === "DONE" ||
      existing.cancellation ||
      existing.time_to <= new Date()
    ) {
      return NextResponse.json(
        { success: false, error: "This trip can no longer be cancelled" },
        { status: 409 },
      );
    }

    // Same private folder as hall cancellations (outside /public).
    const uploadDir = path.join(process.cwd(), "uploads", "cancellations");
    await mkdir(uploadDir, { recursive: true });
    const storedFileName = `OBCANCEL-${nanoid(10)}${path.extname(proof.name) || ""}`;
    await writeFile(
      path.join(uploadDir, storedFileName),
      Buffer.from(await proof.arrayBuffer()),
    );

    const [reservation, cancellation] = await prisma.$transaction([
      prisma.obReservation.update({
        where: { ob_id: obId },
        data: { status: "FOR_REVIEW" },
      }),
      prisma.obCancellation.create({
        data: {
          cancellation_id: `OBCANCEL-${nanoid(10)}`,
          reason: reason.trim(),
          file_name: proof.name,
          path: `/uploads/cancellations/${storedFileName}`,
          obReservationId: obId,
        },
      }),
    ]);

    const logs = await writeLog({
      event_type: "CANCELLED",
      event: "Cancel OB Reservation",
      changes: `Cancellation requested. Reason: ${reason.trim()}`,
      reservation_type: "OB",
      obReservationId: obId,
      userId: user.userId,
    });

    return NextResponse.json({ success: true, data: reservation, cancellation, logs });
  } catch (error) {
    console.error("OB cancel failed:", error);
    return NextResponse.json(
      { success: false, error: `Failed to cancel OB reservation: ${error}` },
      { status: 500 },
    );
  }
}

// GET /api/reservations/ob_reservations/cancel?ob_id=xxx
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const obId = new URL(req.url).searchParams.get("ob_id");
  if (!obId) {
    return NextResponse.json(
      { success: false, error: "ob_id is required" },
      { status: 400 },
    );
  }

  const reservation = await prisma.obReservation.findUnique({
    where: { ob_id: obId },
    include: { cancellation: true },
  });

  if (
    !reservation ||
    (session.user.systemRole === "USER" && reservation.userId !== session.user.userId)
  ) {
    return NextResponse.json(
      { success: false, error: "OB reservation not found" },
      { status: 404 },
    );
  }

  if (!reservation.cancellation) {
    return NextResponse.json(
      { success: false, error: "No cancellation found for this trip" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, cancellation: reservation.cancellation });
}

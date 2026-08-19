import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";

type LogInput = {
  event_type: string;
  event: string;
  changes?: string;
  reservation_type?: string;
  reservationId?: string | null;
  userId?: string | null;
};

// Best-effort audit log.
// - Skips when there is no actor (userId), so a missing session can't crash the request.
// - Never throws (e.g. FK errors from a non-DB admin account), so logging can never
//   break the primary create/update/delete operation.
export async function writeLog(data: LogInput) {
  if (!data.userId) return null;

  try {
    return await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: data.event_type,
        event: data.event,
        changes: data.changes,
        reservation_type: data.reservation_type,
        reservationId: data.reservationId ?? undefined,
        userId: data.userId,
      },
    });
  } catch (e) {
    console.error("writeLog failed:", e);
    return null;
  }
}

import nodemailer from "nodemailer";

type TicketReservation = {
  reservation_id: string;
  purpose: string;
  attendees_qty: number;
  date_appointment: Date | string;
  time_from: Date | string;
  time_to: Date | string;
  other_request?: string | null;
  status: string;
  hall?: { hall_name: string }[];
  hall_user?: { name: string; email?: string; department?: string } | null;
};

// Sends a reservation as a ticket to Spiceworks Cloud Help Desk via its
// email-to-ticket inbox. Best-effort: if SMTP isn't configured or the send
// fails, it logs and returns without throwing, so it never blocks approval.
export async function sendSpiceworksTicket(reservation: TicketReservation) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    SPICEWORKS_INBOX,
  } = process.env;

  if (!SMTP_HOST || !SMTP_FROM || !SPICEWORKS_INBOX) {
    console.warn(
      "[Spiceworks] skipped: env not loaded ->",
      "SMTP_HOST:", !!SMTP_HOST,
      "SMTP_FROM:", !!SMTP_FROM,
      "SPICEWORKS_INBOX:", !!SPICEWORKS_INBOX,
    );
    return { sent: false, reason: "not_configured" };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: SMTP_SECURE === "true", // true for 465, false for 587/STARTTLS
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    });

    const halls =
      (reservation.hall ?? []).map((h) => h.hall_name).join(", ") || "—";
    const dateStr = new Date(reservation.date_appointment).toLocaleDateString();
    const timeFrom = new Date(reservation.time_from).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const timeTo = new Date(reservation.time_to).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const body = [
      "A hall reservation has been APPROVED.",
      "",
      `Reservation ID: ${reservation.reservation_id}`,
      `Purpose: ${reservation.purpose}`,
      `Reserved by: ${reservation.hall_user?.name ?? "Unknown"}`,
      `Department: ${reservation.hall_user?.department ?? "—"}`,
      `Hall(s): ${halls}`,
      `Date: ${dateStr}`,
      `Time: ${timeFrom} - ${timeTo}`,
      `Attendees: ${reservation.attendees_qty}`,
      `Other request: ${reservation.other_request || "—"}`,
      `Status: ${reservation.status}`,
    ].join("\n");

    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: SPICEWORKS_INBOX,
      subject: `Hall Reservation Approved - ${reservation.reservation_id}`,
      text: body,
    });

    console.log(
      "[Spiceworks] sent ->",
      "messageId:", info.messageId,
      "| accepted:", info.accepted,
      "| rejected:", info.rejected,
    );

    return {
      sent: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (e: any) {
    console.error("[Spiceworks] send failed:", e?.message ?? e);
    return { sent: false, reason: "error", error: e?.message ?? String(e) };
  }
}

import { NextRequest, NextResponse } from "next/server";

// POST /api/webhooks/reservation
// Only accepts calls that carry the shared secret in the
// `x-webhook-secret` header (env WEBHOOK_SECRET). With no secret configured
// the endpoint is switched off. It no longer echoes the payload back.
export async function POST(request: NextRequest) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, message: "Webhook disabled" }, { status: 503 });
  }
  if (request.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    console.log("=== RESERVATION WEBHOOK RECEIVED ===", body?.reservation_id ?? "");
    return NextResponse.json({ success: true, message: "Reservation webhook received" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { success: false, message: "Invalid webhook payload" },
      { status: 400 },
    );
  }
}

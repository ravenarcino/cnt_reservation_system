import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("=== RESERVATION WEBHOOK RECEIVED ===");
    console.log(body);

    return NextResponse.json({
      success: true,
      message: "Reservation webhook received",
      reservation: body,
    });
  } catch (error) {
    console.error("Webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Invalid webhook payload",
      },
      { status: 400 },
    );
  }
}

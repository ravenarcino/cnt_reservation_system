import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { sendMail } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email: string | undefined = body.email?.trim();

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 },
      );
    }

    const user = await prisma.users.findUnique({ where: { email } });

    // Always respond success, even if the user doesn't exist or is deleted,
    // so we don't reveal which emails are registered.
    const genericSuccess = NextResponse.json(
      {
        success: true,
        message: "If that email exists, a reset link has been sent.",
      },
      { status: 200 },
    );

    if (!user || user.deletedAt) {
      return genericSuccess;
    }

    // Generate a reset token valid for 1 hour
    const token = nanoid(48);
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.users.update({
      where: { user_id: user.user_id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

    try {
      await sendMail({
        to: user.email,
        subject: "Reset your password",
        text: [
          `Hi ${user.name},`,
          "",
          "We received a request to reset your password.",
          "Click the link below to set a new password. This link expires in 1 hour:",
          "",
          resetLink,
          "",
          "If you didn't request this, you can safely ignore this email.",
        ].join("\n"),
        html: `
          <p>Hi ${user.name},</p>
          <p>We received a request to reset your password. Click the button below to set a new password. This link expires in 1 hour.</p>
          <p><a href="${resetLink}" style="display:inline-block;padding:10px 18px;background:#166534;color:#fff;border-radius:6px;text-decoration:none;">Reset Password</a></p>
          <p>Or paste this link into your browser:<br/>${resetLink}</p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
      });
    } catch (mailErr) {
      // Roll back the token so a failed email doesn't leave a dangling token.
      console.error("Password reset email failed:", mailErr);
      await prisma.users.update({
        where: { user_id: user.user_id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      return NextResponse.json(
        {
          success: false,
          error: "Could not send reset email. Please try again later.",
        },
        { status: 500 },
      );
    }

    return genericSuccess;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to process request: ${error}` },
      { status: 500 },
    );
  }
}

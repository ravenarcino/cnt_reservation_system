import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, password, confirmPassword } = body as {
      token?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Reset token is missing" },
        { status: 400 },
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: "Password must be at least 8 characters long",
        },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Passwords do not match" },
        { status: 400 },
      );
    }

    // Find a user with this token that hasn't expired and isn't deleted
    const user = await prisma.users.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "This reset link is invalid or has expired" },
        { status: 400 },
      );
    }

    const hashed = await bcrypt.hash(password, 10);

    await prisma.users.update({
      where: { user_id: user.user_id },
      data: {
        password: hashed,
        resetToken: null,
        resetTokenExpiry: null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { success: true, message: "Password has been reset successfully" },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: `Failed to reset password: ${error}` },
      { status: 500 },
    );
  }
}

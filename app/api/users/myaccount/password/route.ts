import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return Response.json(
        { error: "Current and new password are required" },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return Response.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 },
      );
    }

    // Get user from DB
    const user = await prisma.users.findUnique({
      where: { user_id: session.user.userId },
    });

    if (!user || !user.password) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Check current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return Response.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in DB
    await prisma.users.update({
      where: { user_id: session.user.userId },
      data: { password: hashedPassword },
    });

    const logs = await prisma.logs.create({
      data: {
        log_id: `LOG-${nanoid(10)}`,
        event_type: "UPDATED",
        event: "Update Password",
        changes: "User changed their account password",
        reservation_type: "Info",
        userId: session.user.userId,
      },
    });

    return Response.json({
      success: true,
      message: "Password updated successfully",
      logs,
    });
  } catch (error) {
    console.error("Error updating password:", error);
    return Response.json({ error: "Failed to update password" }, { status: 500 });
  }
}
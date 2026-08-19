import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  // Get the current user's session
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the user from the database using the userId from the session
  const user = await prisma.users.findUnique({
    where: {
      user_id: session.user.userId,
    },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Return the user data (omit password for security)
  const { password, ...userWithoutPassword } = user;
  return Response.json(userWithoutPassword);
}

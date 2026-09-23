import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userSystemRole } from "@prisma/client";

export async function GET(req: Request) {
  // Feeds filter dropdowns on admin pages - any signed-in user may read it,
  // but it is not public.
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);

  const departmentsOnly = searchParams.get("departmentsOnly");
  // const systemRole = searchParams.get("systemRole") as userSystemRole;

  // if (!systemRole) {
  //   return Response.json({ error: "systemRole is required" }, { status: 400 });
  // }

  if (departmentsOnly === "true") {
    const departments = await prisma.users.findMany({
      select: { department: true },
      // where: { deletedAt: null, systemRole: systemRole },
      where: { deletedAt: null },
    });

    const unique = [...new Set(departments.map((r) => r.department))];
    return Response.json({ data: unique });
  }
}

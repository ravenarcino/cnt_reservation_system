import { prisma } from "@/lib/prisma";
// import { auth } from "@/lib/auth";
import { userSystemRole } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const systemRolesOnly = searchParams.get("rolesOnly");
  // const systemRole = searchParams.get("systemRole") as userSystemRole;

  // if (!systemRole) {
  //   return Response.json({ error: "systemRole is required" }, { status: 400 });
  // }

  if (systemRolesOnly === "true") {
    const systemRoles = await prisma.users.findMany({
      select: { systemRole: true },
      // where: { deletedAt: null, systemRole: systemRole },
      where: { deletedAt: null },
    });

    const unique = [...new Set(systemRoles.map((r) => r.systemRole))];
    return Response.json({ data: unique });
  }
}

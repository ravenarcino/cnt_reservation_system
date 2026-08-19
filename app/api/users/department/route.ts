import { prisma } from "@/lib/prisma";
// import { auth } from "@/lib/auth";
import { userSystemRole } from "@prisma/client";

export async function GET(req: Request) {
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

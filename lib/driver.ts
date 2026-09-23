import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Helpers for the driver role: linking a login account to a Driver record,
// and finding the Driver record of the signed-in user.

export class DriverAccountError extends Error {}

// Validates body.userId for a driver create/update.
//   undefined -> leave as is, "" / null -> unlink, otherwise must be an active
//   DRIVER account that is not linked to another driver.
export async function resolveDriverAccount(
  userId: unknown,
  currentDriverId?: string,
): Promise<string | null | undefined> {
  if (userId === undefined) return undefined;
  if (userId === null || userId === "") return null;

  const id = String(userId);
  const user = await prisma.users.findUnique({
    where: { user_id: id },
    select: { systemRole: true, deletedAt: true, driver: { select: { driver_id: true } } },
  });
  if (!user || user.deletedAt) throw new DriverAccountError("Account not found");
  if (user.systemRole !== "DRIVER")
    throw new DriverAccountError("Account must have the Driver system role");
  if (user.driver && user.driver.driver_id !== currentDriverId)
    throw new DriverAccountError("Account is already linked to another driver");
  return id;
}

export function driverAccountErrorResponse(error: unknown) {
  if (error instanceof DriverAccountError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  return null;
}

// Driver record of the signed-in DRIVER user, or null.
export async function getDriverForUser(userId: string) {
  return prisma.driver.findFirst({ where: { userId, deletedAt: null } });
}

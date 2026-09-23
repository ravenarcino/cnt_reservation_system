import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

// POST /api/signup  { name, email, department, role, password, confirmPassword }
// Public self sign-up. The account is always a regular USER and starts
// UNREGISTERED, so it cannot sign in until an admin activates it in User
// Management. Nothing in the body can raise the role or status.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const department = String(body.department ?? "").trim();
    const role = String(body.role ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const confirm = String(body.confirmPassword ?? "");

    if (!name || !email || !department || !role) return bad("Please fill in all fields");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad("Enter a valid email address");
    if (password.length < 8) return bad("Password must be at least 8 characters long");
    if (password !== confirm) return bad("Passwords do not match");

    const existing = await prisma.users.findUnique({ where: { email }, select: { id: true } });
    if (existing) return bad("An account with this email already exists", 409);

    await prisma.users.create({
      data: {
        user_id: `UID-${nanoid(10)}`,
        name,
        email,
        department,
        role,
        password: await bcrypt.hash(password, 10),
        systemRole: "USER",
        status: "UNREGISTERED",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signup failed:", error);
    return bad("Failed to create account", 500);
  }
}

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

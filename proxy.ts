import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Route guard (Next 16 "proxy", formerly middleware).
// Protects /ob_admin and /driver: signed-out visitors go to the login page,
// signed-in users with another role go to their own dashboard.
// The API routes still check the role themselves - this only guards pages.

const HOME_BY_ROLE: Record<string, string> = {
  SUPER_ADMIN: "/super_admin/user-management",
  IT_ADMIN: "/it_admin/dashboard",
  HALL_ADMIN: "/hall_admin/dashboard",
  OB_ADMIN: "/ob_admin/dashboard",
  DRIVER: "/driver/dashboard",
  USER: "/user/dashboard",
};

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  const required = request.nextUrl.pathname.startsWith("/driver")
    ? "DRIVER"
    : "OB_ADMIN";

  if (token.systemRole !== required) {
    const home = HOME_BY_ROLE[token.systemRole] ?? "/user/dashboard";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/ob_admin/:path*", "/driver/:path*"],
};

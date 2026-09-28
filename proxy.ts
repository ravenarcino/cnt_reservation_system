import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Route guard (Next 16 "proxy", formerly middleware) for every signed-in
// area. Signed-out visitors go to the login page; signed-in users opening an
// area that is not theirs go to their own home page. The API routes still
// check the role themselves - this only guards pages.

const HOME_BY_ROLE: Record<string, string> = {
  SUPER_ADMIN: "/super_admin/dashboard",
  IT_ADMIN: "/super_admin/dashboard",
  HALL_ADMIN: "/hall_admin/dashboard",
  OB_ADMIN: "/ob_admin/dashboard",
  DRIVER: "/driver/dashboard",
  USER: "/user/dashboard",
};

// Which roles may open each area. /user is the booking area, so every
// signed-in role may use it to reserve for themselves.
const AREA_ROLES: Record<string, string[]> = {
  "/super_admin": ["SUPER_ADMIN", "IT_ADMIN"],
  "/hall_admin": ["HALL_ADMIN"],
  "/ob_admin": ["OB_ADMIN"],
  "/driver": ["DRIVER"],
  "/user": Object.keys(HOME_BY_ROLE),
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

  const path = request.nextUrl.pathname;
  const area = Object.keys(AREA_ROLES).find((a) => path === a || path.startsWith(a + "/"));

  if (area && !AREA_ROLES[area].includes(token.systemRole)) {
    const home = HOME_BY_ROLE[token.systemRole] ?? "/user/dashboard";
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/super_admin/:path*",
    "/hall_admin/:path*",
    "/ob_admin/:path*",
    "/driver/:path*",
    "/user/:path*",
  ],
};

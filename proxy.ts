import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./src/features/auth/constansts";

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  return response;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/about" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/api/health" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSessionCookie && !isPublicPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json(
          { error: "Authentication required." },
          { status: 401 },
        ),
      );
    }

    const loginUrl = new URL("login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

    return withSecurityHeaders(NextResponse.next());
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

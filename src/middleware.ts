import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Session guard middleware — protects all (app) routes.
 * Full implementation (session token validation) is handled in a later task.
 * For now, we match the (app) route group paths and pass through.
 */
export function middleware(request: NextRequest) {
  // TODO: validate session_token cookie and redirect to /login if invalid/expired
  return NextResponse.next();
}

export const config = {
  // Match all routes under the (app) route group
  matcher: [
    "/home/:path*",
    "/destinations/:path*",
    "/trip/:path*",
    "/profile/:path*",
  ],
};

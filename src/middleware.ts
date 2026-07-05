import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Session guard middleware — protects all (app) routes.
 *
 * Edge Runtime cannot use Node.js modules (pg, crypto, bcrypt) or Drizzle ORM,
 * so this middleware performs cookie-presence checks only. Full session
 * validation (expiry, token lookup) is handled by Server Components/Actions
 * via Auth_Service.getSession().
 *
 * Flow:
 * 1. If `session_token` cookie is missing → redirect to /login
 * 2. If `setup_complete` cookie is missing → redirect to /setup
 * 3. Otherwise → pass through
 *
 * Requirements: 1.6, 1.7
 */
export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get("session_token");

  // No session cookie → user is not authenticated → redirect to login
  if (!sessionToken?.value) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Session exists but setup not complete → redirect to setup page
  // The `setup_complete` cookie is set by the login/setup actions when
  // the user's profile setup is confirmed.
  const setupComplete = request.cookies.get("setup_complete");

  if (!setupComplete?.value || setupComplete.value !== "true") {
    const setupUrl = new URL("/setup", request.url);
    return NextResponse.redirect(setupUrl);
  }

  // Authenticated and setup complete → allow request
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

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Session guard middleware — protects all (app) routes and handles /setup access.
 *
 * Edge Runtime cannot use Node.js modules (pg, crypto, bcrypt) or Drizzle ORM,
 * so this middleware performs cookie-presence checks only. Full session
 * validation (expiry, token lookup) is handled by Server Components/Actions
 * via Auth_Service.getSession().
 *
 * Flow:
 * For /setup:
 * 1. If user has session_token AND setup_complete=true → redirect to /home
 * 2. Otherwise (guest or mid-setup user) → allow through
 *
 * For all other matched routes:
 * 1. If `session_token` cookie is missing → redirect to /login
 * 2. If `setup_complete` cookie is missing → redirect to /setup
 * 3. Otherwise → pass through
 *
 * Requirements: 1.6, 1.7, 2.1, 2.3
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("session_token");
  const setupComplete = request.cookies.get("setup_complete");

  // The /demo experience is public (no auth) — always allow it through.
  if (pathname === "/demo" || pathname.startsWith("/demo/")) {
    return NextResponse.next();
  }

  // Special handling for /setup route
  if (pathname === "/setup") {
    // Already authenticated + setup done → redirect away
    if (sessionToken?.value && setupComplete?.value === "true") {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    // Otherwise allow access (guest registering, or user mid-setup)
    return NextResponse.next();
  }

  // All other matched routes: require session + setup_complete
  if (!sessionToken?.value) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (!setupComplete?.value || setupComplete.value !== "true") {
    const setupUrl = new URL("/setup", request.url);
    return NextResponse.redirect(setupUrl);
  }

  // Authenticated and setup complete → allow request
  return NextResponse.next();
}

export const config = {
  // Match all routes under the (app) route group + /setup
  matcher: [
    "/home/:path*",
    "/destinations/:path*",
    "/trip/:path*",
    "/profile/:path*",
    "/setup",
  ],
};

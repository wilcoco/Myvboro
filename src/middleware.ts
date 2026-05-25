import { NextResponse, type NextRequest } from "next/server";

// Lightweight auth gate. We only check cookie presence here (full
// validation runs in route handlers / server components against the DB);
// the goal is to avoid rendering an authenticated-only page for users
// without a session cookie at all.
const PROTECTED = [/^\/profile/, /^\/places\/new/];
const COOKIE = "mv_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((rx) => rx.test(pathname))) return NextResponse.next();
  if (req.cookies.get(COOKIE)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next's own asset paths and API routes (API routes do their own auth).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};

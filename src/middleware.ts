import { NextResponse, type NextRequest } from "next/server";

/**
 * Host split: the admin surface lives on its own hostname.
 *
 * Why: admin is the highest-value target in the product and it was sharing an
 * origin with the marketing site, the customer portal, and the Vapi webhooks.
 * Giving it a hostname of its own means it can be gated independently — a
 * Cloudflare Access policy in front of `admin.tworing.ai` stops unauthenticated
 * requests at the edge, before they ever reach the app — and it shrinks what an
 * XSS anywhere in the public site can reach.
 *
 * The session cookie is deliberately host-scoped (no `domain` attribute, see
 * lib/auth.ts), so a session on tworing.ai is NOT sent to admin.tworing.ai.
 * That is the safe direction: staff sign in once on the admin host, and a
 * compromise of any other subdomain cannot replay an admin session. Do not add
 * `domain: ".tworing.ai"` to fix the extra sign-in — it would hand the admin
 * cookie to every subdomain.
 */
const ADMIN_HOST = process.env.ADMIN_HOST ?? "admin.tworing.ai";

/** The admin surface: reachable ONLY on the admin host, and nowhere else. */
function isAdminSurface(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/staff" ||
    pathname.startsWith("/staff/")
  );
}

export function middleware(request: NextRequest) {
  // `host` carries the port in dev; the hostname alone is what we route on.
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname, search } = request.nextUrl;

  // Local development and direct-to-instance access serve everything from one
  // origin. Splitting there would make /admin unreachable, since there is no
  // admin.localhost to redirect to.
  if (!host.endsWith("tworing.ai")) return NextResponse.next();

  if (host === ADMIN_HOST) {
    // The bare admin host should land on the admin index, not the marketing
    // page. A rewrite rather than a redirect so the URL stays clean.
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.rewrite(url);
    }

    if (isAdminSurface(pathname)) return NextResponse.next();

    // Call recordings are read by the admin call view's <audio> element, so they must
    // answer on this host too. They cannot simply point at tworing.ai: the session cookie
    // is host-scoped on purpose (see above), so a cross-host request carries no session and
    // the route correctly refuses it — which the browser shows as a play button that does
    // nothing. Serving them per-host keeps the cookie with the request.
    //
    // This is not a hole in the split. The point of the split is keeping the marketing
    // site, the customer portal and the telephony webhooks off this hostname; a
    // session-authenticated read of a recording is admin surface in everything but name.
    if (pathname.startsWith("/api/recordings/")) return NextResponse.next();

    // Logout is shared with the customer portal and sends everyone to /login.
    // On this host that is the wrong door — send staff back to their own.
    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/staff/login";
      url.search = "";
      return NextResponse.redirect(url, 307);
    }

    // Everything else — marketing pages, the customer portal, and the Vapi
    // webhooks — has no reason to answer on the admin hostname. Keeping them
    // off it is the point of the split.
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  // Public hosts: the admin surface has moved. 307 rather than 308 so this is
  // reversible — browsers cache a permanent redirect hard, and undoing a host
  // split should not require every staff member to clear their cache.
  if (isAdminSurface(pathname)) {
    return NextResponse.redirect(`https://${ADMIN_HOST}${pathname}${search}`, 307);
  }

  return NextResponse.next();
}

export const config = {
  // Static assets and Next internals must pass untouched or nothing renders.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|opengraph-image).*)",
  ],
};

import { SignJWT } from "jose";
import { getSession } from "@/lib/auth";
import { authUrl, googleConfigured } from "@/lib/google";

// Kicks off the Google Calendar connect flow for the signed-in org.
// State is a short-lived JWT so the callback can't be forged cross-org.
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.redirect(new URL("/login", process.env.PLATFORM_URL));
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    return new Response("forbidden", { status: 403 });
  }
  if (!googleConfigured()) {
    return new Response("Google OAuth is not configured on the server", {
      status: 503,
    });
  }

  const state = await new SignJWT({ orgId: session.orgId, userId: session.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET));

  return Response.redirect(authUrl(state), 302);
}

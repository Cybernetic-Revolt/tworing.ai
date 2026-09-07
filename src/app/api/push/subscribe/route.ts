import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManagePush, pushConfigured } from "@/lib/push";

// Register this browser's push subscription for the signed-in user.
//
// Idempotent on the endpoint: re-subscribing from the same device (after a key rotation, a
// browser update, or just a second visit) updates the row. If the endpoint already belongs to
// a different user, it moves — one device, one owner, and the most recent sign-in wins.
//
// JSON errors, not redirects: this is called by fetch() from the page and by the service
// worker, neither of which can follow a redirect to /login usefully.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!canManagePush(session)) {
    return NextResponse.json({ error: "not available in the demo" }, { status: 403 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "push is not enabled on this server" }, { status: 503 });
  }

  let body: { subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const sub = body.subscription;
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  // Only a push service's https URL is a subscription. Anything else is a malformed client.
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 2000 || !p256dh || !auth) {
    return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.userId, endpoint, p256dh, auth, userAgent },
    update: { userId: session.userId, p256dh, auth, userAgent },
  });
  return NextResponse.json({ ok: true });
}

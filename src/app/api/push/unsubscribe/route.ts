import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Forget this browser's subscription. Scoped to the signed-in user: a user can only remove
// their own devices, and a foreign endpoint simply matches nothing.
export async function POST(req: NextRequest) {
  const session = await requireSession();
  let body: { endpoint?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "missing endpoint" }, { status: 400 });

  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.userId } });
  return NextResponse.json({ ok: true });
}

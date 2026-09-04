import { jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { exchangeCode } from "@/lib/google";

const SETTINGS = "/app/calendar/settings";

function back(params: string): Response {
  const base = process.env.PLATFORM_URL ?? "https://tworing.ai";
  return Response.redirect(`${base}${SETTINGS}?${params}`, 303);
}

export async function GET(req: NextRequest): Promise<Response> {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return back("google=denied");

  let orgId: string;
  let stateUserId: string | undefined;
  try {
    const { payload } = await jwtVerify(
      state,
      new TextEncoder().encode(process.env.SESSION_SECRET),
      { algorithms: ["HS256"] },
    );
    orgId = payload.orgId as string;
    stateUserId =
      typeof payload.userId === "string" ? payload.userId : undefined;
  } catch {
    return back("google=expired");
  }

  // Bind the callback to the browser that started it: the signed-in user must
  // own the target org and match the state (CSRF / connection-fixation guard).
  const session = await getSession();
  if (
    !session ||
    session.orgId !== orgId ||
    (stateUserId && session.userId !== stateUserId)
  ) {
    return back("google=denied");
  }

  try {
    const { refreshToken, email } = await exchangeCode(code);
    const encrypted = encryptSecret(refreshToken);
    // Keyed by (orgId, email): reconnecting the SAME Google account refreshes its token,
    // while a DIFFERENT account adds a second connection rather than overwriting the first.
    // Its calendars (GoogleCalendar rows) are preserved on reconnect — only the token moves.
    await prisma.googleConnection.upsert({
      where: { orgId_email: { orgId, email } },
      create: { orgId, email, refreshToken: encrypted },
      update: { refreshToken: encrypted, lastError: null },
    });
    return back("google=connected");
  } catch (err) {
    console.error("google oauth callback failed", err);
    return back("google=error");
  }
}

import { jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { exchangeCode, getAccount } from "@/lib/jobber";

const BACK = "/app/connections";

function back(params: string): Response {
  const base = process.env.PLATFORM_URL ?? "https://tworing.ai";
  return Response.redirect(`${base}${BACK}?${params}`, 303);
}

export async function GET(req: NextRequest): Promise<Response> {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return back("jobber=denied");

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
    return back("jobber=expired");
  }

  // Bind the callback to the browser that started it (CSRF / fixation guard).
  const session = await getSession();
  if (
    !session ||
    session.orgId !== orgId ||
    (stateUserId && session.userId !== stateUserId)
  ) {
    return back("jobber=denied");
  }

  try {
    const tok = await exchangeCode(code);
    let accountId: string | null = null;
    try {
      accountId = (await getAccount(tok.access_token)).id;
    } catch {
      // account query best-effort; tokens still stored
    }
    await prisma.jobberConnection.upsert({
      where: { orgId },
      create: {
        orgId,
        accessToken: encryptSecret(tok.access_token),
        refreshToken: encryptSecret(tok.refresh_token),
        accountId,
      },
      update: {
        accessToken: encryptSecret(tok.access_token),
        refreshToken: encryptSecret(tok.refresh_token),
        accountId,
        lastError: null,
      },
    });
    return back("jobber=connected");
  } catch (err) {
    console.error("jobber oauth callback failed", err);
    return back("jobber=error");
  }
}

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

const COOKIE = "bilco_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export type Session = {
  userId: string;
  orgId: string;
  role: string;
  email: string;
  engineer?: boolean;
};

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  if (s.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(s);
}

// sessionEpoch pins a token to a point in time of the user's account. Bumping
// User.sessionEpoch (on password change or a privilege change) invalidates
// every token minted before it — i.e. real revocation / "log out everywhere".
export async function createSession(
  session: Session,
  sessionEpoch: number,
): Promise<void> {
  const token = await new SignJWT({ ...session, sessionEpoch })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const cookie = (await cookies()).get(COOKIE);
  if (!cookie) return null;

  let payload;
  try {
    const res = await jwtVerify(cookie.value, secret(), {
      algorithms: ["HS256"],
    });
    payload = res.payload;
  } catch {
    return null;
  }

  const userId = typeof payload.userId === "string" ? payload.userId : null;
  const orgId = typeof payload.orgId === "string" ? payload.orgId : null;
  const role = typeof payload.role === "string" ? payload.role : null;
  // orgId is checked for ABSENCE, not for truthiness. Staff who belong to no organisation
  // are minted with `orgId: ""` on purpose (see staff/login/actions.ts) — an empty string is
  // a valid claim meaning "no tenant", and `!orgId` threw those sessions away one request
  // after issuing them. The cookie was set, the next request discarded it, and the redirect
  // back to /staff/login was indistinguishable from a wrong password.
  if (!userId || orgId === null || !role) return null;
  // Tokens minted before sessionEpoch existed have no claim; treat as 0 so this
  // change does not force-log-out everyone on deploy.
  const tokenEpoch =
    typeof payload.sessionEpoch === "number" ? payload.sessionEpoch : 0;

  // Re-validate against the DB on every request — this is what makes the
  // stateless token revocable. The engineer flag and email are re-derived LIVE
  // (so demoting an engineer or deleting the user takes effect immediately),
  // and a sessionEpoch bump invalidates the token outright.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, isEngineer: true, sessionEpoch: true },
  });
  if (!user) return null;
  if (user.sessionEpoch !== tokenEpoch) return null;

  return { userId, orgId, role, email: user.email, engineer: user.isEngineer };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireEngineer(): Promise<Session> {
  const session = await getSession();
  // Staff and customers have separate entrances. Sending an unauthenticated engineer to the
  // customer login is how you end up with staff logged into a tenant's portal.
  if (!session) redirect("/staff/login");
  if (!session.engineer) redirect("/app");
  return session;
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

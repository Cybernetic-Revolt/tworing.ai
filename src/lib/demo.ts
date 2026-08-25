import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const DEMO_USER_EMAIL = "demo@tworing.app";

// Demo companies are real orgs flagged isDemoOrg — each demo persona has its
// own portal, exactly like a paying client would. Sessions are MEMBER-level
// (read-only by construction) for the passwordless demo user.
export async function startDemoSession(slug: string): Promise<boolean> {
  const [org, user] = await Promise.all([
    prisma.org.findUnique({ where: { slug } }),
    prisma.user.findUnique({ where: { email: DEMO_USER_EMAIL } }),
  ]);
  if (!org?.isDemoOrg || !user) return false;

  await createSession(
    {
      userId: user.id,
      orgId: org.id,
      role: "MEMBER",
      email: user.email,
      engineer: false,
    },
    user.sessionEpoch,
  );
  return true;
}

export async function listDemoOrgs() {
  return prisma.org.findMany({
    where: { isDemoOrg: true },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });
}

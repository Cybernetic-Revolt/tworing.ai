import { prisma } from "@/lib/db";

export type SignupRow = Awaited<ReturnType<typeof prisma.signup.findMany>>[number];
export type SignupOrg = { id: string; slug: string };

/**
 * Trial requests with the client org each one became, if any.
 *
 * The nav badge and the page both need "how many are still waiting on you", and computing
 * it twice is how the badge ends up nagging about a row the page calls done. One function,
 * one answer. A request counts as waiting only when it is neither ticked as handled nor
 * already a client — matched on the owner's email first, since that is what the trial mail
 * is addressed to, then on business name for rows created before the email was known.
 */
export async function signupsWithStatus(): Promise<{
  rows: { signup: SignupRow; org: SignupOrg | undefined }[];
  waiting: number;
}> {
  const [signups, orgs] = await Promise.all([
    prisma.signup.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.org.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        members: { select: { user: { select: { email: true } } } },
      },
    }),
  ]);

  const byEmail = new Map<string, SignupOrg>();
  const byName = new Map<string, SignupOrg>();
  for (const o of orgs) {
    const ref = { id: o.id, slug: o.slug };
    byName.set(o.name.toLowerCase(), ref);
    for (const m of o.members) byEmail.set(m.user.email.toLowerCase(), ref);
  }

  const rows = signups.map((signup) => ({
    signup,
    org: byEmail.get(signup.email.toLowerCase()) ?? byName.get(signup.business.toLowerCase()),
  }));
  return { rows, waiting: rows.filter((r) => !r.signup.handled && !r.org).length };
}

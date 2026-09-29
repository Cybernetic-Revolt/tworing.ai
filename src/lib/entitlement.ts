import { prisma } from "@/lib/db";
import { wallTime, zonedToUtc } from "@/lib/tz";

/**
 * Whether an org's line should still be answering, and how.
 *
 * Every inbound call resolves its assistant through /api/assistants/by-did, which makes that
 * the one place where "this account has run out" can be enforced without trusting the engine
 * to check. Nothing enforced it before: a cancelled client, a client 90 days past due and a
 * trial that ended six weeks ago all kept full service forever.
 *
 * The distinction that matters is who pays for the overage.
 *
 * A SELF-SERVE TRIAL runs on a phone number we bought and minutes we are paying for, handed
 * to someone we have not spoken to. That is a standing cost exposure with no ceiling, so it
 * stops: past the minutes or past the end date, the line answers with a short line explaining
 * the trial has ended and takes nothing further.
 *
 * Everyone else keeps answering. A paying client's overage is a billing conversation, not a
 * reason to stop answering their customers' calls — cutting off a plumber's phone because he
 * had a busy month is how you lose the plumber.
 *
 * **A trial is what `Org.trialEndsAt` says it is, never what is missing.** The first version
 * of this inferred "trial" from having no Stripe subscription row, which is true of every
 * hand-provisioned org including bilco's own — six live numbers that would have started
 * telling callers the trial was over the moment this deployed. Absence of a marker now means
 * "not a trial", so the failure mode of a mistake here is a line that keeps answering.
 */

export const TIER_MINUTES: Record<string, number | null> = {
  ANSWER: 400,
  OFFICE: 800,
  OPERATIONS: 1200,
  CUSTOM: null,
};

/** Minutes a self-serve trial may use before the line stops. */
export const TRIAL_MINUTES = 60;
/** Days a self-serve trial runs from signup. */
export const TRIAL_DAYS = 14;

export type Entitlement =
  | { state: "ok" }
  /** Answer, but say the trial is over and do nothing else. */
  | { state: "trial_ended"; reason: "minutes" | "expired" }
  /** Keep answering normally; the owner is over and should hear about it. */
  | { state: "over_soft"; usedMinutes: number; capMinutes: number };

export type EntitlementInput = {
  /**
   * Set ONLY by the self-serve provisioner. Null means a hand-provisioned account, which is
   * never hard-stopped.
   */
  trialEndsAt: Date | null;
  /** Demo companies are ours and are never stopped. */
  isDemoOrg: boolean;
  subscription: { status: string } | null;
  tier: string;
  usedMinutes: number;
  now: Date;
};

/**
 * Pure so the rule can be tested without a database, and so the ordering is readable:
 * a paying account is never stopped, an ended trial always is, everything else answers.
 */
export function entitlementFor(input: EntitlementInput): Entitlement {
  const { trialEndsAt, isDemoOrg, subscription, tier, usedMinutes, now } = input;

  // Our own demo companies. Never stopped, whatever else is true.
  if (isDemoOrg) return { state: "ok" };

  // A paid subscription outranks a leftover trial marker: someone who signed up self-serve
  // and then paid must not be stopped on the day their trial window would have lapsed.
  const paying =
    subscription != null &&
    ["ACTIVE", "PAST_DUE", "PAUSED"].includes(subscription.status);

  if (!paying && trialEndsAt != null) {
    // A self-serve trial, and nobody is paying for it but us.
    if (subscription?.status === "CANCELED") return { state: "trial_ended", reason: "expired" };
    if (now >= trialEndsAt) return { state: "trial_ended", reason: "expired" };
    if (usedMinutes >= TRIAL_MINUTES) return { state: "trial_ended", reason: "minutes" };
    return { state: "ok" };
  }

  // Everything else keeps answering. Over the plan is worth saying out loud, never worth
  // silencing a business's phone over.
  const cap = TIER_MINUTES[tier] ?? null;
  return cap != null && usedMinutes >= cap
    ? { state: "over_soft", usedMinutes, capMinutes: cap }
    : { state: "ok" };
}

/** What the assistant says when a trial is over. Answered, brief, and not a dead line. */
export function trialEndedGreeting(businessName: string): string {
  return (
    `Thanks for calling ${businessName}. This line was set up as a TwoRing trial and the ` +
    `trial has now ended, so I can't take messages or bookings. Please try the business ` +
    `directly. Goodbye.`
  );
}

/** Minutes of call time this org has used since `since`. Rounded up per call, as billed. */
export async function minutesUsed(orgId: string, since: Date): Promise<number> {
  const calls = await prisma.call.findMany({
    where: { orgId, startedAt: { gte: since } },
    select: { durationSec: true },
  });
  return calls.reduce((m, c) => m + Math.ceil((c.durationSec ?? 0) / 60), 0);
}

/** Start of the current calendar month in the org's own timezone. */
export function monthStart(tz: string, now: Date): Date {
  const w = wallTime(now, tz);
  return zonedToUtc(w.y, w.mo, 1, 0, tz);
}

/**
 * The live entitlement for an org, reading usage from the database.
 *
 * A trial counts minutes from the day it started, since a trial that resets on the 1st would
 * hand a signup on the 30th two allowances.
 */
export async function entitlementForOrg(
  org: {
    id: string;
    tier: string;
    timezone: string;
    createdAt: Date;
    isDemoOrg: boolean;
    trialEndsAt: Date | null;
  },
  subscription: { status: string } | null,
  now: Date = new Date(),
): Promise<Entitlement & { usedMinutes: number }> {
  // A trial counts from the day it started; a trial that reset on the 1st would hand a
  // signup on the 30th two allowances. A managed account counts by calendar month.
  const onTrial = org.trialEndsAt != null;
  const since = onTrial ? org.createdAt : monthStart(org.timezone, now);
  const usedMinutes = await minutesUsed(org.id, since);
  const e = entitlementFor({
    trialEndsAt: org.trialEndsAt,
    isDemoOrg: org.isDemoOrg,
    subscription,
    tier: org.tier,
    usedMinutes,
    now,
  });
  return { ...e, usedMinutes };
}

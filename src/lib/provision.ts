import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { TRIAL_DAYS } from "@/lib/entitlement";

/**
 * Turn a trial request into a working account.
 *
 * Signup used to write a row and email the founder, and everything after that was seven
 * manual steps across two vendor consoles. This does the platform half automatically and
 * records honestly which parts of the telephony half succeeded, because the one thing worse
 * than a slow signup is one that reports success and leaves a business with a dead line.
 *
 * Ordering is deliberate: everything that can be rolled back cheaply happens before anything
 * that touches a vendor. The org, the owner and the assistant are ours to delete. Claiming a
 * number and pointing it at the engine is not, so it happens last and its failure downgrades
 * the result rather than aborting it — the account still exists, the owner can still sign in,
 * and a human attaches a number later.
 */

/** ElevenLabs voice for a new trial — the one two live assistants already use. */
export const TRIAL_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

/** Tools a trial assistant is given. Exported so a test can check the prompt promises them. */
export const TRIAL_TOOLS = [
  "check_availability",
  "book_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "find_appointments",
  "take_message",
] as const;

/** A URL-safe org slug that is not already taken. */
export function slugCandidates(business: string): string[] {
  const base =
    business
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "client";
  // Suffixes rather than a random slug: the slug shows up in support conversations and
  // "acme-2" is something a human can say out loud.
  return [base, ...Array.from({ length: 50 }, (_, i) => `${base}-${i + 2}`)];
}

/** A stable key for the assistant, unique across the platform. */
export function assistantKeyCandidates(slug: string): string[] {
  return [slug, ...Array.from({ length: 50 }, (_, i) => `${slug}-${i + 2}`)];
}

export type ProvisionResult = {
  orgId: string;
  slug: string;
  userId: string;
  /** The one-time link the welcome email sends them to. */
  setPasswordUrl: string;
  /** Null when the pool was empty or routing failed — the account still works. */
  e164: string | null;
  /** What did not happen, in words a human can act on. Empty means fully provisioned. */
  warnings: string[];
};

async function firstFree(candidates: string[], taken: (v: string) => Promise<boolean>) {
  for (const c of candidates) if (!(await taken(c))) return c;
  return null;
}

/**
 * Claim a spare number, atomically.
 *
 * Compare-and-set on `claimedByOrgId`, retried, because a read-then-write would hand the same
 * DID to two businesses that signed up in the same second and route one's callers to the
 * other. Returns null when the pool is empty, which is a normal state, not an error.
 */
export async function claimNumber(orgId: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = await prisma.numberPool.findFirst({
      where: { claimedByOrgId: null },
      orderBy: { createdAt: "asc" },
    });
    if (!candidate) return null;
    const won = await prisma.numberPool.updateMany({
      where: { id: candidate.id, claimedByOrgId: null },
      data: { claimedByOrgId: orgId, claimedAt: new Date() },
    });
    if (won.count === 1) return candidate;
    // Someone else took it between the read and the write. Try the next one.
  }
  return null;
}

/** A single-use link that lets the new owner set their first password. */
export async function issueSetPasswordLink(userId: string, days = 7): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.passwordReset.create({
    data: {
      userId,
      tokenHash: createHash("sha256").update(raw).digest("hex"),
      // Longer than a password reset: this is the only way into a brand-new account, and an
      // hour-long link that expires while someone is on a roof is a support call.
      expiresAt: new Date(Date.now() + days * 86_400_000),
    },
  });
  const base = process.env.PLATFORM_URL ?? "https://tworing.ai";
  return `${base}/reset?token=${raw}`;
}

export type SignupInput = {
  business: string;
  name: string;
  email: string;
  phone: string;
  trade?: string | null;
  city?: string | null;
};

/** The assistant a brand-new trial answers with, built from what they told us. */
export function trialAssistantCopy(business: string, trade?: string | null) {
  const what = trade && !/^other/i.test(trade) ? trade.toLowerCase() : "the work";
  return {
    greeting: `Thanks for calling ${business}, this is #NAME#. How can I help?`,
    recordingNotice: "Just so you know, this call is recorded so we keep accurate notes.",
    systemPrompt:
      `You are #NAME#, the receptionist for ${business}, a business that does ${what}. ` +
      `You answer the phone when the owner cannot.\n\n` +
      `Your job, in order of priority:\n` +
      `1. Be warm and brief. These are customers, and they are often calling from a job site or a car.\n` +
      `2. Find out what they need and how urgent it is.\n` +
      `3. Get their name and the best number to reach them on. This matters more than anything else — ` +
      `a message without a callback number is a lost customer.\n` +
      `4. If they want to book, offer a time and book it. You MUST call check_availability ` +
      `before offering any time, and you MUST call book_appointment before telling anyone ` +
      `they are booked. Saying it without calling the tool means no appointment exists.\n` +
      `5. Take a clear message for anything you cannot handle.\n\n` +
      `Never invent prices, never promise a specific tradesperson, and never guarantee a time you ` +
      `have not booked. If you do not know, say you will have someone call back, and make sure you ` +
      `have the number to do it.`,
    endCallMessage: "Thanks for calling, we'll be in touch shortly. Bye now.",
  };
}

/**
 * Provision a trial. Safe to call more than once for the same email: if that person already
 * owns an org, nothing is created and the existing org is returned, because a double-submitted
 * form must not produce a second business with a second phone number.
 */
export async function provisionTrial(input: SignupInput): Promise<ProvisionResult | null> {
  const email = input.email.trim().toLowerCase();
  const warnings: string[] = [];

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { org: true } } },
  });
  if (existing?.memberships.length) {
    return null; // Already a client. The caller decides what to say about that.
  }

  const slug = await firstFree(slugCandidates(input.business), async (s) =>
    Boolean(await prisma.org.findUnique({ where: { slug: s }, select: { id: true } })),
  );
  if (!slug) return null;

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);

  // Everything ours, in one transaction: either they get a whole account or none of one.
  const { org, user } = await prisma.$transaction(async (tx) => {
    const org = await tx.org.create({
      data: {
        slug,
        name: input.business.trim(),
        tier: "ANSWER",
        notifyEmail: email,
        trialEndsAt,
        // Defaults so the receptionist can offer times on day one rather than telling every
        // caller the calendar is not configured.
        calendarSettings: { create: {} },
        availabilityRules: {
          create: [1, 2, 3, 4, 5].map((weekday) => ({
            weekday,
            startMin: 8 * 60,
            endMin: 17 * 60,
          })),
        },
      },
    });
    const user =
      existing ??
      (await tx.user.create({ data: { email, name: input.name.trim() || null } }));
    await tx.membership.create({ data: { userId: user.id, orgId: org.id, role: "OWNER" } });
    return { org, user };
  });

  // The assistant. Outside the transaction because its key is unique platform-wide and a
  // collision should cost a retry, not the whole account.
  const key = await firstFree(assistantKeyCandidates(slug), async (k) =>
    Boolean(await prisma.assistant.findUnique({ where: { key: k }, select: { id: true } })),
  );
  const copy = trialAssistantCopy(input.business.trim(), input.trade);
  const assistant = key
    ? await prisma.assistant
        .create({
          data: {
            orgId: org.id,
            key,
            name: "Receptionist",
            botName: "Sam",
            status: "PRODUCTION",
            greeting: copy.greeting,
            systemPrompt: copy.systemPrompt,
            recordingNotice: copy.recordingNotice,
            recordsCall: true,
            announceRecording: true,
            endCallMessage: copy.endCallMessage,
            endCallPhrases: [],
            // Matches what the live production assistants carry, minus transferCall: a new
            // trial has no human line to transfer to, and an assistant that offers to put
            // someone through and cannot is worse than one that never offers.
            tools: [...TRIAL_TOOLS],
            voiceProvider: "elevenlabs",
            // The voice two of the live assistants already use. A null voice is valid in the
            // schema and produces an assistant that cannot speak, so it is set explicitly.
            voiceId: TRIAL_VOICE_ID,
          },
        })
        .catch(() => null)
    : null;
  if (!assistant) warnings.push("assistant was not created — the line cannot answer yet");

  const setPasswordUrl = await issueSetPasswordLink(user.id);

  // Telephony last: it is the only part we cannot undo by deleting a row.
  let e164: string | null = null;
  const spare = await claimNumber(org.id);
  if (!spare) {
    warnings.push("no spare number in the pool — assign one by hand");
  } else if (!assistant) {
    warnings.push(`number ${spare.e164} claimed but not attached — no assistant to answer it`);
  } else {
    await prisma.phoneNumber.create({
      data: {
        orgId: org.id,
        e164: spare.e164,
        provider: spare.provider,
        sipSubaccount: spare.sipSubaccount,
        label: "Trial line",
        assistantId: assistant.id,
      },
    });
    e164 = spare.e164;
  }

  return { orgId: org.id, slug, userId: user.id, setPasswordUrl, e164, warnings };
}

// Web Push to portal users' phones and desktops.
//
// Three things wake an owner's phone: a call has ended (with its outcome), the receptionist
// booked a job, and the receptionist took a booking that needs the owner's OK. Each is a
// short, factual notification that deep-links to the row in the portal.
//
// Fan-out is by MEMBERSHIP: an event on an org reaches every user who belongs to that org,
// on every device they subscribed, filtered by that user's own preferences. A push that fails
// never fails the business event — every send is fire-and-forget and logged — and an endpoint
// the push service says is gone (404/410) is pruned so we stop paying to talk to it.
//
// Sending needs VAPID keys. The private key lives only in the server env file; the public
// key reaches the browser at request time (as a prop), never baked into the build.
import webpush from "web-push";
import { prisma } from "@/lib/db";
import { DEMO_USER_EMAIL } from "@/lib/demo";

/**
 * Whether this session may enrol devices or set preferences.
 *
 * The demo login is one shared, passwordless user with a membership in every demo org — the
 * repo's rule is that it is read-only. Letting it subscribe would let any anonymous visitor
 * pile up subscription rows, flip the shared preferences, and receive whatever those orgs'
 * events carry. So: not the demo user, and that is the whole test.
 */
export function canManagePush(session: { email: string }): boolean {
  return session.email !== DEMO_USER_EMAIL;
}

export type PushKind = "call" | "booking" | "pending";

/** What the service worker renders. Kept flat and JSON-safe — it crosses the push service encrypted. */
export type PushPayload = {
  kind: PushKind;
  title: string;
  body: string;
  /** Root-relative portal path the notification opens. */
  url: string;
  /** Per-entity tag so a second push about the same call/booking replaces the first. */
  tag: string;
};

function vapid(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT ?? "https://tworing.ai" };
}

export function pushConfigured(): boolean {
  return vapid() !== null;
}

/** The public VAPID key for the browser's `applicationServerKey`, or null when push is off. */
export function pushPublicKey(): string | null {
  return vapid()?.publicKey ?? null;
}

// ---------------------------------------------------------------------------------------
// Notification copy. Pure, so the exact words are testable without a call or a database.
// A phone notification is read in one glance: the title says what happened, the body says
// who / when / what. No ids, no internal reason codes.

function prettyPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

function who(name: string | null | undefined, phone: string | null | undefined): string {
  const p = prettyPhone(phone);
  if (name && p) return `${name} · ${p}`;
  return name ?? p ?? "Unknown caller";
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}

/** "Tue Sep 8, 8:00 a.m." — a booking time that fits a notification title. */
export function compactWhen(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  // en-CA abbreviates as "Tue." / "Sep." — drop those dots, keep "a.m." intact.
  const bare = (s: string) => s.replace(/\.$/, "");
  return `${bare(get("weekday"))} ${bare(get("month"))} ${get("day")}, ${get("hour")}:${get("minute")} ${get("dayPeriod")}`.replace(/\s+/g, " ").trim();
}

// The notification carries its own timestamp, so the call body does not repeat the time: it
// leads with who called, then what the AI wrote down.
export function callNotification(call: {
  id: string;
  callerName: string | null;
  callerNumber: string | null;
  disposition: string | null;
  summary: string | null;
}): PushPayload {
  const title =
    call.disposition === "BOOKED"
      ? "New call — booked"
      : call.disposition === "RESCHEDULED"
        ? "New call — rescheduled"
        : call.disposition === "CANCELLED"
          ? "New call — cancelled a booking"
          : call.disposition === "MESSAGE"
            ? "New call — left a message"
            : call.disposition === "MISSED"
              ? "Missed call"
              : "New call";
  const lead = who(call.callerName, call.callerNumber);
  const body = call.summary ? `${lead}\n${clip(call.summary, 140)}` : lead;
  return { kind: "call", title, body, url: `/app/calls/${call.id}`, tag: `call-${call.id}` };
}

export function bookingNotification(appt: {
  id: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  jobType: string | null;
  address: string | null;
  startsAt: Date;
}, tz: string): PushPayload {
  const when = compactWhen(appt.startsAt, tz);
  const job = appt.jobType ?? "Service call";
  const details = [who(appt.customerName, appt.customerPhone), appt.address].filter(Boolean).join(" · ");
  const pending = appt.status === "PENDING";
  return {
    kind: pending ? "pending" : "booking",
    title: pending ? "Booking needs your OK" : `Booked: ${when}`,
    body: pending ? `${when} — ${job}\n${details}` : `${job}\n${details}`,
    url: `/app/calendar/${appt.id}`,
    tag: `appt-${appt.id}`,
  };
}

// ---------------------------------------------------------------------------------------
// Recipients. Pure: given the org's members (with their prefs) decide who gets this kind.

export type Member = {
  userId: string;
  pref: { calls: boolean; bookings: boolean; pendingConfirmations: boolean } | null;
};

/** A missing pref row means "everything on" — the first subscribe is useful without a second form. */
export function wantsKind(pref: Member["pref"], kind: PushKind): boolean {
  if (!pref) return true;
  return kind === "call" ? pref.calls : kind === "booking" ? pref.bookings : pref.pendingConfirmations;
}

export function selectRecipients(members: Member[], kind: PushKind): string[] {
  return members.filter((m) => wantsKind(m.pref, kind)).map((m) => m.userId);
}

// ---------------------------------------------------------------------------------------
// Delivery. The sender is injected so the prune/isolation contract is testable without a
// push service: 404/410 => the endpoint is dead; 401/403 => the subscription was created
// against a different VAPID key than the one we now sign with (a rotation) and can never
// succeed — delete it either way, and the device re-subscribes on its next visit to
// Settings → Notifications. Any other failure => log and carry on to the next device.

/** Push-service statuses after which this subscription row can never deliver again. */
export const DEAD_STATUSES = new Set([401, 403, 404, 410]);

export type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
export type SendIO = {
  /** Resolves on 2xx; rejects with `{ statusCode }` (web-push's shape) otherwise. */
  send: (sub: Sub, body: string) => Promise<void>;
  prune: (id: string) => Promise<void>;
  touch: (id: string) => Promise<void>;
};

export async function deliver(
  subs: Sub[],
  payload: PushPayload,
  io: SendIO,
): Promise<{ sent: number; pruned: number; failed: number }> {
  const body = JSON.stringify(payload);
  let sent = 0, pruned = 0, failed = 0;
  for (const sub of subs) {
    try {
      await io.send(sub, body);
      sent++;
      await io.touch(sub.id).catch(() => {});
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status !== undefined && DEAD_STATUSES.has(status)) {
        pruned++;
        await io.prune(sub.id).catch(() => {});
      } else {
        failed++;
        console.error("push send failed", sub.id, status ?? String(err).slice(0, 200));
      }
    }
  }
  return { sent, pruned, failed };
}

/**
 * Push `payload` to every subscribed device of every member of `orgId` who wants this kind.
 *
 * Silent no-op when VAPID is not configured. Callers `void` this — it must never delay or
 * fail the call/booking that triggered it.
 */
export async function notifyOrg(orgId: string, payload: PushPayload): Promise<void> {
  const keys = vapid();
  if (!keys) return;

  // The demo user is excluded here too, so even a row that somehow exists never gets a push.
  const memberships = await prisma.membership.findMany({
    where: { orgId, user: { email: { not: DEMO_USER_EMAIL } } },
    select: { userId: true, user: { select: { notificationPref: true } } },
  });
  const userIds = selectRecipients(
    memberships.map((m) => ({ userId: m.userId, pref: m.user.notificationPref })),
    payload.kind,
  );
  if (userIds.length === 0) {
    console.log("push", payload.kind, { orgId, recipients: 0, reason: "no member wants this kind" });
    return;
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) {
    console.log("push", payload.kind, { orgId, recipients: userIds.length, devices: 0 });
    return;
  }

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  const result = await deliver(subs, payload, {
    send: async (sub, body) => {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
        // A phone that is off for a day should still get "you have a booking" when it wakes;
        // after that the portal is the source of truth. Pending confirmations are the ones
        // an owner must act on, so they jump the queue.
        { TTL: 86_400, urgency: payload.kind === "pending" ? "high" : "normal" },
      );
    },
    prune: async (id) => {
      await prisma.pushSubscription.delete({ where: { id } });
    },
    touch: async (id) => {
      await prisma.pushSubscription.update({ where: { id }, data: { lastUsedAt: new Date() } });
    },
  });
  console.log("push", payload.kind, { orgId, ...result });
}

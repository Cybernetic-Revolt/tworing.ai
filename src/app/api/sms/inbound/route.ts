import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { sendEmail } from "@/lib/email";
import { inboundSmsEmail } from "@/lib/email-templates";
import { sendSmsToCustomer } from "@/lib/sms";

// VoIP.ms inbound-SMS callback. Configured as the DID's SMS URL callback with
// ?secret=<SMS_INBOUND_SECRET>; VoIP.ms appends from/to/message/id (GET).
// Records the inbound message, threads it, and honors CASL STOP/START.
export const dynamic = "force-dynamic";

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const START_WORDS = ["START", "UNSTOP", "YES"];
const ACK_WINDOW_MS = 10 * 60_000; // at most one auto-ack per thread per 10 min
const NOTIFY_WINDOW_MS = 5 * 60_000; // at most one owner email per thread per 5 min

function secretOk(got: string | null): boolean {
  const expected = process.env.SMS_INBOUND_SECRET;
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Atomically claim a throttle window: succeeds for exactly one caller per
// window, even under concurrent callbacks (conditional UPDATE on one row).
async function claimWindow(
  threadId: string,
  field: "lastAutoAckAt" | "lastNotifiedAt",
  windowMs: number,
): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const res = await prisma.smsThread.updateMany({
    where: {
      id: threadId,
      OR: [{ [field]: null }, { [field]: { lt: cutoff } }],
    },
    data: { [field]: now },
  });
  return res.count === 1;
}

export async function GET(req: NextRequest): Promise<Response> {
  const q = req.nextUrl.searchParams;
  if (!secretOk(q.get("secret"))) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const fromRaw = q.get("from");
  const toRaw = q.get("to");
  const message = (q.get("message") ?? "").trim();
  const providerId = q.get("id") ?? undefined;
  if (!fromRaw || !toRaw) return new NextResponse("ok"); // nothing to do

  const did = normalizePhone(toRaw);
  const customer = normalizePhone(fromRaw);
  if (!did || !customer) return new NextResponse("ok");
  const number = await prisma.phoneNumber.findUnique({ where: { e164: did } });
  if (!number) return new NextResponse("ok"); // unknown DID — ignore
  const orgId = number.orgId;

  // Idempotency: VoIP.ms can retry the same message id. Don't double-record or
  // re-fire notifications.
  if (providerId) {
    const dup = await prisma.message.findFirst({
      where: { orgId, providerId, direction: "INBOUND" },
      select: { id: true },
    });
    if (dup) return new NextResponse("ok");
  }

  // An inbound text establishes implied consent for a reply (CASL).
  const thread = await prisma.smsThread.upsert({
    where: { orgId_customerPhone: { orgId, customerPhone: customer } },
    create: {
      orgId,
      customerPhone: customer,
      consentState: "IMPLIED",
      lastMessageAt: new Date(),
    },
    update: { lastMessageAt: new Date() },
  });

  const upper = message.toUpperCase();
  const isStop = STOP_WORDS.includes(upper);
  const isStart = START_WORDS.includes(upper);
  let consentState = thread.consentState;
  if (isStop) {
    await prisma.smsThread.update({
      where: { id: thread.id },
      data: { consentState: "OPTED_OUT", consentAt: new Date() },
    });
    consentState = "OPTED_OUT";
  } else if (isStart) {
    // A bare START/YES restores implied consent — it is not documented express
    // opt-in, so don't overstate it as EXPRESS.
    await prisma.smsThread.update({
      where: { id: thread.id },
      data: { consentState: "IMPLIED", consentAt: new Date() },
    });
    consentState = "IMPLIED";
  }

  await prisma.message.create({
    data: {
      orgId,
      threadId: thread.id,
      channel: "SMS",
      direction: "INBOUND",
      status: "RECEIVED",
      toAddress: did,
      fromAddress: customer,
      body: message,
      providerId,
    },
  });

  // A real reply (not a consent keyword) from a customer who hasn't opted out:
  // notify the owner and reassure the customer. Both are throttled per thread.
  if (!isStop && !isStart && consentState !== "OPTED_OUT") {
    const org = await prisma.org.findUnique({ where: { id: orgId } });
    if (org?.notifyEmail && (await claimWindow(thread.id, "lastNotifiedAt", NOTIFY_WINDOW_MS))) {
      const tpl = inboundSmsEmail({
        tz: org.timezone,
        customerPhone: customer,
        message,
        threadId: thread.id,
        receivedAt: new Date(),
      });
      void sendEmail({
        orgId,
        to: org.notifyEmail,
        subject: tpl.subject,
        html: tpl.html,
        template: "inbound-sms-notify",
      }).catch(() => {});
    }

    // CASL-compliant auto-ack: names the sender and carries opt-out instructions.
    if (await claimWindow(thread.id, "lastAutoAckAt", ACK_WINDOW_MS)) {
      const name = org?.name ?? "the team";
      void sendSmsToCustomer({
        orgId,
        toE164: customer,
        body: `Thanks — we got your message and someone at ${name} will get right back to you. Reply STOP to opt out.`,
        template: "sms-auto-ack",
      }).catch(() => {});
    }
  }

  return new NextResponse("ok");
}

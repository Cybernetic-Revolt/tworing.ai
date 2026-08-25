// Platform email via Resend. Every send is recorded as a Message row so the
// portal can always answer "what did the system send?" (spec §4.7).
// Until mail.tworing.ai is verified, set MAIL_FROM to onboarding@resend.dev
// (Resend only delivers that sender to the account owner's own address).
import { prisma } from "@/lib/db";

const RESEND_URL = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress(orgName: string): string {
  // Verified-domain sender once mail.tworing.ai is live; test sender until then.
  const domain = process.env.MAIL_FROM_DOMAIN;
  const verified = process.env.MAIL_DOMAIN_VERIFIED === "1";
  if (domain && verified) {
    const slug = orgName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
    return `${orgName} <${slug || "hello"}@${domain}>`;
  }
  return "TwoRing <onboarding@resend.dev>";
}

type SendArgs = {
  orgId: string;
  to: string;
  subject: string;
  html: string;
  template?: string;
  replyTo?: string;
  callId?: string;
  leadId?: string;
  fromName?: string;
};

export async function sendEmail(args: SendArgs): Promise<void> {
  const org = await prisma.org.findUniqueOrThrow({ where: { id: args.orgId } });
  const from = fromAddress(args.fromName ?? org.name);

  const msg = await prisma.message.create({
    data: {
      orgId: args.orgId,
      callId: args.callId,
      leadId: args.leadId,
      channel: "EMAIL",
      toAddress: args.to,
      fromAddress: from,
      subject: args.subject,
      body: args.html,
      template: args.template,
      status: "QUEUED",
    },
  });

  if (!emailConfigured()) {
    await prisma.message.update({
      where: { id: msg.id },
      data: { status: "FAILED", error: "RESEND_API_KEY not set" },
    });
    return;
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text();
      await prisma.message.update({
        where: { id: msg.id },
        data: { status: "FAILED", error: `HTTP ${res.status}: ${text.slice(0, 300)}` },
      });
      return;
    }
    const data = (await res.json()) as { id?: string };
    await prisma.message.update({
      where: { id: msg.id },
      data: { status: "SENT", providerId: data.id },
    });
  } catch (err) {
    await prisma.message
      .update({
        where: { id: msg.id },
        data: { status: "FAILED", error: String(err).slice(0, 300) },
      })
      .catch(() => {});
  }
}

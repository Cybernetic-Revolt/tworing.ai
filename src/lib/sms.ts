// Platform SMS via VoIP.ms. Every send is recorded as a Message (channel SMS)
// and threaded in SmsThread, which also holds the CASL consent state.
// Sends are blocked to numbers that have opted out.
import { prisma } from "@/lib/db";
import { sendSms as voipmsSend, voipmsConfigured } from "@/lib/voipms";
import { normalizePhone } from "@/lib/phone";

// 10-digit form VoIP.ms expects (strip +1).
function tenDigits(e164: string): string {
  const d = e164.replace(/[^\d]/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

// The org's SMS-capable sending DID (a VoIP.ms number with SMS enabled).
async function sendingDid(orgId: string): Promise<string | null> {
  const num = await prisma.phoneNumber.findFirst({
    where: { orgId, provider: "voipms", smsEnabled: true },
  });
  return num ? tenDigits(num.e164) : null;
}

export type SmsResult = "sent" | "opted_out" | "no_did" | "not_configured" | "failed";

export async function sendSmsToCustomer(opts: {
  orgId: string;
  toE164: string;
  body: string;
  template?: string;
  callId?: string;
  leadId?: string;
  appointmentId?: string;
}): Promise<SmsResult> {
  // Normalize so one customer is always one thread (matches the inbound side).
  const to = normalizePhone(opts.toE164) ?? opts.toE164;
  // Consent: never message a number that opted out.
  const thread = await prisma.smsThread.upsert({
    where: { orgId_customerPhone: { orgId: opts.orgId, customerPhone: to } },
    create: { orgId: opts.orgId, customerPhone: to, consentState: "IMPLIED", lastMessageAt: new Date() },
    update: { lastMessageAt: new Date() },
  });
  if (thread.consentState === "OPTED_OUT") return "opted_out";

  // If the org isn't set up to send SMS, this is a no-op — NOT a failure.
  // Skip before creating a record so the Messages ledger isn't littered with
  // red "FAILED" rows for orgs that simply don't have an SMS number.
  if (!voipmsConfigured()) return "not_configured";
  const did = await sendingDid(opts.orgId);
  if (!did) return "no_did";

  const record = await prisma.message.create({
    data: {
      orgId: opts.orgId,
      callId: opts.callId,
      leadId: opts.leadId,
      appointmentId: opts.appointmentId,
      channel: "SMS",
      direction: "OUTBOUND",
      threadId: thread.id,
      toAddress: to,
      fromAddress: did,
      body: opts.body,
      template: opts.template,
      status: "QUEUED",
    },
  });

  try {
    const id = await voipmsSend(did, tenDigits(to), opts.body);
    await prisma.message.update({
      where: { id: record.id },
      data: { status: "SENT", providerId: String(id) },
    });
    return "sent";
  } catch (err) {
    await prisma.message
      .update({ where: { id: record.id }, data: { status: "FAILED", error: String(err).slice(0, 300) } })
      .catch(() => {});
    return "failed";
  }
}

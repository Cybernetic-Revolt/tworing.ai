import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveCallOrg, resolveTenantKey } from "@/lib/tenant-key";
import { fireWebhook } from "@/lib/webhook";
import { sendEmail } from "@/lib/email";
import { leadSummaryEmail } from "@/lib/email-templates";
import { sendSmsToCustomer } from "@/lib/sms";
import { pushBookingToJobber, pushLeadToJobber } from "@/lib/jobber-sync";
import { normalizePhone } from "@/lib/phone";
import { CallDisposition } from "@/generated/prisma/client";

// Vapi server-message envelope; everything beyond what we model is kept in Call.raw
type VapiMessage = {
  type?: string;
  call?: {
    id?: string;
    customer?: { number?: string };
    // The number that was DIALLED. This is what decides the tenant for an engine-wide key,
    // and it is read from the payload but never trusted as an org claim — it is looked up.
    phoneNumber?: { number?: string };
  };
  customer?: { number?: string };
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  endedReason?: string;
  summary?: string;
  transcript?: string;
  recordingUrl?: string;
  artifact?: { recordingUrl?: string };
  cost?: number;
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown>;
  };
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

// The recording URL is rendered in a browser, so it is sanitised rather than trusted:
// javascript:, data:, http: and garbage are all rejected.
//
// Two shapes are accepted. An absolute https URL is what Vapi sent and what historic rows
// hold. A root-relative /api/recordings/ path is what switchboard sends, and it must be
// relative: the portal answers on two hostnames and the session cookie is host-scoped, so
// an absolute URL plays on one host and silently fails on the other.
//
// Rejecting relative paths here is what made every switchboard recording vanish from its
// Call row while sitting complete in S3 — `new URL("/api/...")` throws without a base, so
// the URL was dropped and the row saved without it. The upload had worked; nothing said so.
function recordingUrl(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  // Same-origin path we generate ourselves. Anchored, and no protocol-relative "//host"
  // which would be an off-site absolute URL wearing a relative disguise.
  if (/^\/api\/recordings\/[A-Za-z0-9._-]{1,200}\.wav$/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  // X-Vapi-Secret is what Vapi sends when the assistant's server.secret is
  // set to the tenant ingest key; the custom header serves n8n forwarding.
  const ingestKey = await resolveTenantKey(req);
  if (!ingestKey) {
    return NextResponse.json({ error: "unknown ingest key" }, { status: 401 });
  }

  let body: { message?: VapiMessage } & VapiMessage;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const msg = body.message ?? body;

  // Only end-of-call-report is persisted here; live events (status-updates,
  // transcripts-in-progress) stay with the n8n sidecar for now.
  if (msg.type !== "end-of-call-report") {
    return new NextResponse(null, { status: 204 });
  }

  const vapiCallId = str(msg.call?.id);
  if (!vapiCallId) {
    return NextResponse.json({ error: "missing call.id" }, { status: 400 });
  }

  // Which tenant this call belongs to is decided by the number that was DIALLED, not by the
  // key that presented it. The tools endpoint was fixed this way in 41861fe; this one was
  // not, and used orgId directly.
  //
  // Harmless while every switchboard number belongs to bilco, and a tenant-isolation bug the
  // moment a client cuts over: one engine-wide key answers for every client, so every
  // client's calls, transcripts, recordings and leads would have been filed under whichever
  // org happens to own the key. Silently — a call would simply appear in the wrong portal.
  //
  // A TENANT key still resolves to its own org, so Vapi's existing traffic is unchanged; it
  // now also gets a guard, since a tenant key presenting another org's number is a
  // misconfiguration and guessing which half was right is how data lands in the wrong account.
  const callOrg = await resolveCallOrg(ingestKey, normalizePhone(str(msg.call?.phoneNumber?.number)));
  if (!callOrg.ok) {
    console.warn("ingest rejected", callOrg.error, {
      vapiCallId,
      scope: ingestKey.scope,
    });
    return NextResponse.json({ error: callOrg.error }, { status: callOrg.status });
  }
  const orgId = callOrg.orgId;

  const startedAt = msg.startedAt ? new Date(msg.startedAt) : new Date();
  const endedAt = msg.endedAt ? new Date(msg.endedAt) : null;
  const durationSec =
    msg.durationSeconds != null
      ? Math.round(msg.durationSeconds)
      : endedAt
        ? Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
        : null;

  const callerNumber =
    str(msg.call?.customer?.number) ?? str(msg.customer?.number);
  const summary = str(msg.analysis?.summary) ?? str(msg.summary);

  // An appointment booked mid-call (via /api/vapi/tools) only knows the Vapi
  // call id. Only an ACTIVE one counts as a real booking — a cancelled row must
  // not read as "booked" for either linking or the call outcome.
  const bookedAppt = await prisma.appointment.findFirst({
    where: {
      orgId: orgId,
      vapiCallId,
      callId: null,
      status: { in: ["CONFIRMED", "PENDING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  // A very short call that captured nothing — caller dropped during the greeting.
  const missed =
    durationSec != null &&
    durationSec < 20 &&
    !bookedAppt &&
    !summary &&
    !!callerNumber &&
    !(msg.endedReason ?? "").startsWith("assistant");

  // Outcome of the call, from what the AI actually did mid-call (CallActions,
  // scoped to THIS org). Most significant action wins; reschedule/cancel must be
  // checked before the BOOK/bookedAppt fallback (a reschedule books a new slot).
  const actions = await prisma.callAction.findMany({
    where: { orgId: orgId, vapiCallId },
  });
  const kinds = new Set(actions.map((a) => a.kind));
  const disposition: CallDisposition = kinds.has("RESCHEDULE")
    ? "RESCHEDULED"
    : kinds.has("CANCEL")
      ? "CANCELLED"
      : kinds.has("BOOK") || bookedAppt
        ? "BOOKED"
        : kinds.has("MESSAGE")
          ? "MESSAGE"
          : missed
            ? "MISSED"
            : "INQUIRY";

  const callData = {
    orgId: orgId,
    callerNumber,
    status: "COMPLETED" as const,
    disposition,
    endedReason: str(msg.endedReason),
    startedAt,
    endedAt,
    durationSec,
    summary,
    transcript: str(msg.transcript),
    recordingUrl: recordingUrl(msg.recordingUrl) ?? recordingUrl(msg.artifact?.recordingUrl),
    costUsd: msg.cost != null ? msg.cost : null,
    raw: JSON.parse(JSON.stringify(msg)),
  };

  const call = await prisma.call.upsert({
    where: { vapiCallId },
    create: { vapiCallId, ...callData },
    update: callData,
  });

  // Audit rows consumed — keep the table bounded to in-flight calls.
  void prisma.callAction
    .deleteMany({ where: { orgId: orgId, vapiCallId } })
    .catch(() => {});

  const sd = msg.analysis?.structuredData ?? {};
  const phone =
    normalizePhone(str(sd.phone) ?? str(sd.phone_number) ?? call.callerNumber);

  // One lead per caller: find this caller's lead by normalized phone (durable
  // across calls), or by the Vapi call id if take_message just created it.
  let lead =
    (phone
      ? await prisma.lead.findUnique({
          where: { orgId_phone: { orgId: orgId, phone } },
        })
      : null) ??
    (await prisma.lead.findFirst({
      where: { orgId: orgId, vapiCallId },
      orderBy: { createdAt: "desc" },
    }));

  const sdName = str(sd.name) ?? str(sd.caller_name);
  const sdJob = str(sd.jobType) ?? str(sd.job_type) ?? str(sd.service);

  let isNewLead = false;
  if (lead) {
    // Enrich the existing lead without clobbering details already captured.
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        vapiCallId,
        name: lead.name ?? sdName,
        email: lead.email ?? str(sd.email),
        jobType: lead.jobType ?? sdJob,
        address: lead.address ?? str(sd.address),
        urgency: lead.urgency ?? str(sd.urgency),
        notes: lead.notes ?? str(sd.notes),
        status: bookedAppt ? "BOOKED" : lead.status,
      },
    });
  } else if (phone) {
    isNewLead = true;
    lead = await prisma.lead.create({
      data: {
        orgId: orgId,
        vapiCallId,
        phone,
        name: sdName,
        email: str(sd.email),
        jobType: sdJob,
        address: str(sd.address),
        urgency: str(sd.urgency),
        notes: str(sd.notes),
        status: bookedAppt ? "BOOKED" : "NEW",
      },
    });
    await prisma.leadActivity.create({
      data: {
        orgId: orgId,
        leadId: lead.id,
        actor: "AI",
        kind: "STATUS_CHANGE",
        payload: { from: null, to: lead.status, note: "Captured from call" },
      },
    });
    void fireWebhook(orgId, "lead.created", {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      jobType: lead.jobType,
      address: lead.address,
      urgency: lead.urgency,
      source: "AI",
    }).catch(() => {});
  }

  // Link this call to the caller's lead (many calls -> one lead).
  if (lead) {
    await prisma.call.update({
      where: { id: call.id },
      data: { leadId: lead.id },
    });
  }

  if (bookedAppt && lead) {
    await prisma.appointment.update({
      where: { id: bookedAppt.id },
      data: { callId: call.id, leadId: lead.id },
    });
    await prisma.leadActivity.create({
      data: {
        orgId: orgId,
        leadId: lead.id,
        actor: "AI",
        kind: "APPOINTMENT",
        payload: { appointmentId: bookedAppt.id },
      },
    });
  } else if (bookedAppt) {
    await prisma.appointment.update({
      where: { id: bookedAppt.id },
      data: { callId: call.id },
    });
  }

  // Jobber (Operations tier): a new lead becomes a Client, and a booked
  // appointment upgrades it to a Request. Sequenced in one chain so the
  // client exists (and its id is persisted) before the request references it.
  if (lead) {
    const leadForJobber = lead;
    void (async () => {
      if (isNewLead) {
        await pushLeadToJobber(orgId, leadForJobber.id, {
          name: leadForJobber.name,
          phone: leadForJobber.phone,
          email: leadForJobber.email,
          jobType: leadForJobber.jobType,
        });
      }
      if (bookedAppt) {
        await pushBookingToJobber(orgId, bookedAppt.id);
      }
    })().catch(() => {});
  }

  // Owner notification — the platform sends this directly (replaces the n8n
  // email node). Fire-and-forget; recorded in the Messages ledger.
  const org = callOrg.org;
  if (org.notifyEmail) {
    const tpl = leadSummaryEmail({
      orgName: org.name,
      tz: org.timezone,
      callerName: call.callerName,
      callerNumber: call.callerNumber,
      startedAt: call.startedAt,
      summary: call.summary,
      jobType: lead?.jobType,
      address: lead?.address,
      urgency: lead?.urgency,
      booked: !!bookedAppt,
    });
    void sendEmail({
      orgId: org.id,
      to: org.notifyEmail,
      subject: tpl.subject,
      html: tpl.html,
      template: "lead-summary",
      callId: call.id,
      leadId: lead?.id,
    }).catch(() => {});
  }

  // Missed-call text-back: a very short call that booked nothing — caller likely
  // hung up during the greeting. Text them so the job isn't lost. No-ops for
  // orgs without an SMS-enabled DID, and never messages an opted-out number.
  // (`missed` and the outcome were computed before the upsert above.)
  if (missed) {
    void sendSmsToCustomer({
      orgId: org.id,
      toE164: call.callerNumber!,
      body: `Sorry we missed you at ${org.name} — reply here or call back and our assistant will get you booked.`,
      template: "missed-call-text-back",
      callId: call.id,
    }).catch(() => {});
  }

  await prisma.ingestKey.update({
    where: { id: ingestKey.id },
    data: { lastUsedAt: new Date() },
  });

  return NextResponse.json({ ok: true, callId: call.id });
}

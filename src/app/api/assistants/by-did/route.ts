/**
 * Which assistant answers this number, and how is it configured?
 *
 * The voice engine asks this at the start of every call. Before it existed, switchboard
 * shipped its own copy of each assistant as files in its repo, which meant "configurable"
 * stopped at "edit the code and redeploy". This is the seam that makes the database the
 * source of truth: change a greeting in the product, and the next call uses it.
 *
 * Authenticated with the same per-tenant ingest key as the tool endpoint, and scoped to that
 * tenant — an org's key must never resolve another org's assistant.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { resolveTenantKey } from "@/lib/tenant-key";

export async function GET(req: NextRequest) {
  const key = await resolveTenantKey(req);
  if (!key) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const e164 = normalizePhone(req.nextUrl.searchParams.get("e164"));
  if (!e164) return NextResponse.json({ error: "e164 required" }, { status: 400 });

  const number = await prisma.phoneNumber.findUnique({
    where: { e164 },
    include: { org: true, assistant: { include: { contacts: true } } },
  });

  // A TENANT key is scoped to its own org: without this, any valid key could read any org's
  // prompt and contact list by guessing a number. An ENGINE key is deliberately not scoped
  // that way — it answers for every tenant, and the number it was handed is what decides
  // which one, so the DID *is* the scoping.
  if (!number || (key.scope !== "ENGINE" && number.orgId !== key.orgId)) {
    return NextResponse.json({ error: "no assistant for that number" }, { status: 404 });
  }
  const a = number.assistant;
  if (!a) {
    return NextResponse.json(
      { error: "number has no assistant configured" },
      { status: 404 },
    );
  }
  if (a.status === "RETIRED") {
    // A retired assistant must never answer. Returning it and trusting the caller to check
    // would make this the kind of guard that works until someone forgets.
    return NextResponse.json({ error: "assistant is retired" }, { status: 409 });
  }

  // The greeting the caller actually hears. The notice is appended here rather than stored
  // pre-joined so the legal wording stays reviewable on its own, and so editing a greeting
  // cannot silently drop it.
  // announceRecording is checked as well as recordsCall. An assistant may record without
  // announcing it — a deliberate, per-assistant choice — and that is not the same as not
  // recording. The engine's own guard relaxes only on the same explicit flag, so the two
  // ends agree rather than one silently overriding the other.
  const greeting =
    a.recordsCall && a.announceRecording && a.recordingNotice
      ? `${a.greeting.trim()} ${a.recordingNotice.trim()}`
      : a.greeting;

  return NextResponse.json(
    {
      key: a.key,
      org: number.orgId,
      orgName: number.org.name,
      timezone: number.org.timezone,
      greeting,
      systemPrompt: a.systemPrompt,
      voiceProvider: a.voiceProvider,
      voiceId: a.voiceId,
      tools: a.tools,
      endCallPhrases: a.endCallPhrases,
      endCallMessage: a.endCallMessage,
      transferTo: a.transferTo,
      transferMessage: a.transferMessage,
      // Null stays null: no limit set is not the same as the default, and the engine
      // distinguishes them.
      silenceTimeoutSeconds: a.silenceTimeoutSeconds,
      maxDurationSeconds: a.maxDurationSeconds,
      recordsCall: a.recordsCall,
      announceRecording: a.announceRecording,
      // Numbers only, with how to treat them. The engine needs to recognise a caller; it has
      // no reason to know why someone is in the list.
      contacts: a.contacts.map((c) => ({ e164: c.e164, name: c.name, relation: c.relation })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

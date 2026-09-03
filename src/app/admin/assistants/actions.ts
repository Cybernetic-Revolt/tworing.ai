"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { validateAssistant } from "@/lib/assistant-validation";

const STATUSES = ["PRODUCTION", "TEMPLATE", "RETIRED"] as const;
const RELATIONS = ["PRINCIPAL", "FAMILY", "WORK", "KNOWN", "BLOCKED"] as const;

function pick<T extends readonly string[]>(allowed: T, v: string, fallback: T[number]): T[number] {
  return (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}

/** Newline- or comma-separated free text into a clean list. */
function lines(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function saveAssistant(form: FormData): Promise<void> {
  await requireEngineer();
  const id = String(form.get("id") ?? "");
  if (!id) throw new Error("no assistant id");

  const tools = form.getAll("tools").map(String).filter(Boolean);

  // #PRINCIPAL# only resolves to a name if one is recorded, so validation needs to know.
  // Counted rather than trusted from the form: the contact list is edited by its own actions
  // and a stale hidden field would let the check pass on a stale answer.
  const hasPrincipalContact =
    (await prisma.assistantContact.count({
      where: { assistantId: id, relation: "PRINCIPAL" },
    })) > 0;

  const draft = {
    key: String(form.get("key") ?? "").trim(),
    greeting: String(form.get("greeting") ?? ""),
    systemPrompt: String(form.get("systemPrompt") ?? ""),
    recordingNotice: String(form.get("recordingNotice") ?? "").trim() || null,
    recordsCall: form.get("recordsCall") === "on",
    announceRecording: form.get("announceRecording") === "on",
    voiceId: String(form.get("voiceId") ?? "").trim() || null,
    endCallPhrases: lines(String(form.get("endCallPhrases") ?? "")),
    tools,
    transferTo: String(form.get("transferTo") ?? "").trim() || null,
    hasPrincipalContact,
  };

  // Refuse rather than save-and-warn. A saved config is one that can answer a call, and
  // every rule here guards a failure the caller would experience instead of the operator.
  const errors = validateAssistant(draft);
  if (errors.length) {
    const q = new URLSearchParams({ errors: JSON.stringify(errors) });
    redirect(`/admin/assistants/${id}?${q}`);
  }

  const num = (v: FormDataEntryValue | null): number | null => {
    const s = String(v ?? "").trim();
    if (!s) return null; // null means "no limit was set", which is not the default
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  await prisma.assistant.update({
    where: { id },
    data: {
      name: String(form.get("name") ?? "").trim() || draft.key,
      botName: String(form.get("botName") ?? "").trim() || null,
      status: pick(STATUSES, String(form.get("status") ?? ""), "TEMPLATE"),
      greeting: draft.greeting.trim(),
      systemPrompt: draft.systemPrompt,
      recordingNotice: draft.recordingNotice,
      recordsCall: draft.recordsCall,
      announceRecording: draft.announceRecording,
      voiceProvider: String(form.get("voiceProvider") ?? "elevenlabs").trim() || "elevenlabs",
      voiceId: draft.voiceId,
      endCallPhrases: draft.endCallPhrases,
      endCallMessage: String(form.get("endCallMessage") ?? "").trim() || null,
      transferTo: draft.transferTo,
      transferMessage: String(form.get("transferMessage") ?? "").trim() || null,
      silenceTimeoutSeconds: num(form.get("silenceTimeoutSeconds")),
      maxDurationSeconds: num(form.get("maxDurationSeconds")),
      tools: draft.tools,
    },
  });

  revalidatePath(`/admin/assistants/${id}`);
  redirect(`/admin/assistants/${id}?saved=1`);
}

export async function addContact(form: FormData): Promise<void> {
  await requireEngineer();
  const assistantId = String(form.get("assistantId") ?? "");
  const e164 = normalizePhone(String(form.get("e164") ?? ""));
  const name = String(form.get("name") ?? "").trim();
  if (!assistantId || !e164 || !name) {
    redirect(`/admin/assistants/${assistantId}?contactError=1`);
  }
  const relation = pick(RELATIONS, String(form.get("relation") ?? ""), "KNOWN");

  // One PRINCIPAL per assistant. Two would make which one is recognised depend on row
  // order, and the principal is the identity that unlocks the private tools.
  if (relation === "PRINCIPAL") {
    await prisma.assistantContact.updateMany({
      where: { assistantId, relation: "PRINCIPAL", NOT: { e164 } },
      data: { relation: "KNOWN" },
    });
  }

  await prisma.assistantContact.upsert({
    where: { assistantId_e164: { assistantId, e164 } },
    create: {
      assistantId,
      e164,
      name,
      relation,
      note: String(form.get("note") ?? "").trim() || null,
    },
    update: { name, relation, note: String(form.get("note") ?? "").trim() || null },
  });

  revalidatePath(`/admin/assistants/${assistantId}`);
  redirect(`/admin/assistants/${assistantId}#contacts`);
}

export async function deleteContact(form: FormData): Promise<void> {
  await requireEngineer();
  const id = String(form.get("contactId") ?? "");
  const assistantId = String(form.get("assistantId") ?? "");
  if (id) await prisma.assistantContact.delete({ where: { id } });
  revalidatePath(`/admin/assistants/${assistantId}`);
  redirect(`/admin/assistants/${assistantId}#contacts`);
}

export async function createAssistant(form: FormData): Promise<void> {
  await requireEngineer();
  const orgId = String(form.get("orgId") ?? "");
  const key = String(form.get("key") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!orgId || !key) redirect("/admin/assistants?error=1");

  const created = await prisma.assistant.create({
    data: {
      orgId,
      key,
      name: String(form.get("name") ?? "").trim() || key,
      // New assistants start as TEMPLATE. Answering a real line is a deliberate step, not
      // the default state of a half-filled form.
      status: "TEMPLATE",
      greeting: "",
      systemPrompt: "",
      recordsCall: true,
    },
  });
  redirect(`/admin/assistants/${created.id}`);
}

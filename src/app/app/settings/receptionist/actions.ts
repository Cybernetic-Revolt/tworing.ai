"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SUPPORTED_VOICE_PROVIDERS } from "@/lib/voice-types";

/**
 * The two things a customer may change about their own receptionist: what it is called, and
 * what it sounds like.
 *
 * Everything else on the assistant — the script, the tools, the transfer number, whether it
 * records — stays in admin. That split is the point: those fields decide whether the agent
 * works at all and carry compliance weight, and a client editing the prompt is how an agent
 * quietly stops booking. A name and a voice cannot break a call, so they are safe to hand over
 * and are exactly the two things clients ask to change.
 */

/**
 * A spoken name has to survive being said out loud by a TTS engine.
 *
 * Kept to letters, spaces, hyphens and apostrophes — enough for "Mary-Anne" and "O'Brien",
 * short of anything that would make the model read out punctuation. Length-capped because
 * this is substituted into `#NAME#` wherever it appears in the script.
 */
const NAME_OK = /^[\p{L}][\p{L} '’-]{0,38}$/u;

export async function updateReceptionist(form: FormData): Promise<void> {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/settings/receptionist");
  }

  const assistantId = String(form.get("assistantId") ?? "");
  // Scoped by orgId as well as id: the id arrives from a form, and without this a crafted
  // post would let one tenant rename another tenant's assistant.
  const assistant = await prisma.assistant.findFirst({
    where: { id: assistantId, orgId: session.orgId },
    select: { id: true },
  });
  if (!assistant) redirect("/app/settings/receptionist?error=notfound");

  const botName = String(form.get("botName") ?? "").trim();
  if (botName && !NAME_OK.test(botName)) {
    redirect("/app/settings/receptionist?error=name");
  }
  // A tagged script substitutes #NAME# with botName, falling back to the assistant's admin
  // label — which is a staff-facing string like "Jessica — reception + assistant" or even
  // the business name, never something a receptionist should call itself. So once a script
  // uses the tag, the name field cannot be blanked: the fallback would be spoken to callers.
  if (!botName) {
    const a = await prisma.assistant.findUniqueOrThrow({
      where: { id: assistant.id },
      select: { greeting: true, systemPrompt: true, recordingNotice: true },
    });
    if (/#NAME#/.test(`${a.greeting} ${a.systemPrompt} ${a.recordingNotice ?? ""}`)) {
      redirect("/app/settings/receptionist?error=nameRequired");
    }
  }

  const voiceProvider = String(form.get("voiceProvider") ?? "").trim().toLowerCase();
  const voiceId = String(form.get("voiceId") ?? "").trim();

  // Refuse a provider the engine cannot build. Without this the assistant saves fine and the
  // line goes silent on the next call: the voice id would be looked up against a vendor that
  // does not own it. The engine refuses the same value, but by then a caller is listening.
  if (!SUPPORTED_VOICE_PROVIDERS.includes(voiceProvider)) {
    redirect("/app/settings/receptionist?error=provider");
  }
  // A voice is required once one has been chosen — clearing it would leave the assistant
  // unable to speak at all, which the engine treats as a broken config.
  if (!voiceId) {
    redirect("/app/settings/receptionist?error=voice");
  }

  await prisma.assistant.update({
    where: { id: assistant.id },
    data: { botName: botName || null, voiceProvider, voiceId },
  });

  revalidatePath("/app/settings/receptionist");
  redirect("/app/settings/receptionist?saved=1");
}

import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderTemplate } from "@/lib/assistant-template";
import { cartesiaVoices, elevenlabsVoices } from "@/lib/voices";
import { VoicePicker } from "@/app/admin/assistants/voice-picker";
import { SettingsTabs } from "../../settings-tabs";
import { updateReceptionist } from "./actions";

export const metadata = { title: "Your receptionist — TwoRing" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  name: "That name has characters we can't say reliably. Letters, spaces, hyphens and apostrophes only.",
  provider: "That voice provider isn't one we support.",
  voice: "Pick a voice — your receptionist can't answer without one.",
  notfound: "We couldn't find that assistant on your account.",
  nameRequired:
    "Your receptionist introduces itself by name on every call, so it needs one — pick a name rather than leaving it blank.",
};

const label = "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";
const input =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";
const hint = "text-xs font-normal text-zinc-500 dark:text-zinc-400";

/**
 * The client-facing half of the assistant.
 *
 * Staff write the script; the client owns what their receptionist is called and what it sounds
 * like. Those two are safe to hand over because neither can break a call — unlike the prompt,
 * the tools or the recording notice, where a well-meaning edit produces an agent that sounds
 * fine and quietly stops booking.
 *
 * The greeting is shown, rendered, and not editable. That is deliberate on both counts: a
 * client renaming their receptionist needs to see what the caller will now hear, and showing
 * it as read-only makes the split obvious — "this is yours, that is ours" — rather than
 * leaving them to wonder why the name changed but the script did not.
 */
export default async function ReceptionistPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await requireSession();
  const { error, saved } = await searchParams;
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";

  const [org, assistant] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: session.orgId } }),
    // A tenant has one live receptionist in practice. Ordered so a PRODUCTION one always wins
    // over a leftover template rather than depending on insertion order.
    prisma.assistant.findFirst({
      where: { orgId: session.orgId, status: { not: "RETIRED" } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: { contacts: { where: { relation: "PRINCIPAL" }, take: 1 } },
    }),
  ]);

  if (!assistant) {
    return (
      <div className="max-w-2xl">
        <SettingsTabs />
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your receptionist
        </h1>
        <p className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          No receptionist is set up on your account yet. Once we&rsquo;ve configured one,
          you&rsquo;ll be able to change its name and voice here.
        </p>
      </div>
    );
  }

  const [elevenlabs, cartesia] = await Promise.all([elevenlabsVoices(), cartesiaVoices()]);

  const spokenName = assistant.botName?.trim() || assistant.name;
  // Whether renaming does anything real. A script that never says #NAME# ignores this field
  // entirely, and a settings page that quietly accepts a change it will never apply teaches
  // the customer that settings here don't work. Say so instead.
  const scriptUsesName = /#NAME#/.test(
    `${assistant.greeting} ${assistant.systemPrompt} ${assistant.recordingNotice ?? ""}`,
  );
  // Exactly what by-did will send the engine, built with the same function, so this preview
  // cannot drift from what a caller actually hears.
  const greeting = renderTemplate(
    assistant.recordsCall && assistant.announceRecording && assistant.recordingNotice
      ? `${assistant.greeting.trim()} ${assistant.recordingNotice.trim()}`
      : assistant.greeting,
    {
      name: spokenName,
      business: org.name,
      principal: assistant.contacts[0]?.name ?? null,
    },
  );

  return (
    <div className="max-w-2xl">
      <SettingsTabs />
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Your receptionist
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        What your AI receptionist is called, and what it sounds like when it answers.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {ERRORS[error] ?? "That didn't save."}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Saved. Your next call will use it.
        </p>
      )}

      <form action={updateReceptionist} className="mt-6 flex flex-col gap-5">
        <input type="hidden" name="assistantId" value={assistant.id} />

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Name
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            What it calls itself when it picks up. Used everywhere the script says its name.
          </p>
          <div className="mt-4">
            <label className={label}>
              Receptionist&rsquo;s name
              <input
                name="botName"
                defaultValue={assistant.botName ?? ""}
                placeholder="e.g. Jessica"
                disabled={!canEdit}
                maxLength={39}
                className={input}
              />
              {scriptUsesName ? (
                <span className={hint}>Callers hear this name on every call.</span>
              ) : (
                <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                  Your current call script doesn&rsquo;t use this name yet, so changing it
                  won&rsquo;t change what callers hear. Contact us and we&rsquo;ll wire it in.
                </span>
              )}
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Voice
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Narrow the list, then play a sample. Listen before you save — this is the voice
            every caller hears.
          </p>
          <div className="mt-4">
            <VoicePicker
              providers={[
                {
                  id: "elevenlabs",
                  label: "ElevenLabs",
                  voices: elevenlabs.ok ? elevenlabs.voices : null,
                },
                {
                  id: "cartesia",
                  label: "Cartesia",
                  voices: cartesia.ok ? cartesia.voices : null,
                },
              ]}
              currentProvider={assistant.voiceProvider ?? "elevenlabs"}
              currentVoiceId={assistant.voiceId}
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            What callers hear first
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Your greeting, with the name above filled in. We write the script — talk to us if
            you want it changed.
          </p>
          <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {greeting || <span className={hint}>No greeting is set yet.</span>}
          </p>
        </div>

        {canEdit ? (
          <div>
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Save changes
            </button>
          </div>
        ) : (
          <p className={hint}>
            Only owners and admins can change this. Ask a teammate with those permissions.
          </p>
        )}
      </form>
    </div>
  );
}

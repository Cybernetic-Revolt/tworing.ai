import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { promisedButMissing, validateAssistant } from "@/lib/assistant-validation";
import { addContact, deleteContact, saveAssistant } from "../actions";
import { cartesiaVoices, elevenlabsVoices } from "@/lib/voices";
import { VoicePicker } from "../voice-picker";

export const dynamic = "force-dynamic";

const input =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const label = "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";
const hint = "text-xs font-normal text-zinc-500 dark:text-zinc-400";

/** Everything the platform can dispatch, grouped so the two families read as distinct. */
const TOOL_GROUPS: { title: string; note: string; tools: string[] }[] = [
  {
    title: "Client receptionist",
    note: "Booking and messages against the client's own calendar and lead pipeline.",
    tools: [
      "check_availability",
      "book_appointment",
      "reschedule_appointment",
      "cancel_appointment",
      "find_appointments",
      "take_message",
    ],
  },
  {
    title: "Personal assistant",
    note: "Capture and calendar. The calendar tools only run for the PRINCIPAL contact.",
    tools: [
      "capture_note",
      "add_task",
      "set_reminder",
      "get_calendar",
      "create_calendar_event",
      "update_calendar_event",
      "cancel_calendar_event",
    ],
  },
  {
    title: "Telephony",
    note: "Executed by the phone layer rather than the platform.",
    tools: ["transferCall"],
  },
];

const RELATION_NOTE: Record<string, string> = {
  PRINCIPAL: "the person this assistant works for — unlocks the private tools",
  FAMILY: "greeted by name, messages passed on",
  WORK: "greeted by name, professional handling",
  KNOWN: "recognised",
  BLOCKED: "recognised and screened out",
};

export default async function AssistantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ errors?: string; saved?: string }>;
}) {
  await requireEngineer();
  const { id } = await params;
  const sp = await searchParams;

  const a = await prisma.assistant.findUnique({
    where: { id },
    include: {
      org: true,
      phoneNumbers: true,
      contacts: { orderBy: [{ relation: "asc" }, { name: "asc" }] },
    },
  });
  if (!a) notFound();

  // Voice lists for the picker. Fetched server-side so the admin chooses from the account's
  // real voices rather than pasting an id. Each degrades to a free-text fallback on failure.
  const [elevenlabs, cartesia] = await Promise.all([elevenlabsVoices(), cartesiaVoices()]);

  // Problems with what is currently SAVED, so a config that cannot answer says so on open
  // rather than waiting for someone to press Save.
  const current = validateAssistant({
    key: a.key,
    greeting: a.greeting,
    systemPrompt: a.systemPrompt,
    recordingNotice: a.recordingNotice,
    recordsCall: a.recordsCall,
    voiceId: a.voiceId,
    endCallPhrases: a.endCallPhrases,
    tools: a.tools,
    transferTo: a.transferTo,
  });
  const promised = promisedButMissing(a.systemPrompt, a.tools);
  let rejected: string[] = [];
  try {
    rejected = sp.errors ? (JSON.parse(sp.errors) as string[]) : [];
  } catch {
    rejected = [];
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/admin/assistants" className="text-sm text-zinc-500 hover:underline">
        ← Assistants
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {a.name} <span className="font-mono text-sm text-zinc-500">{a.key}</span>
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {a.org.name}
        {a.phoneNumbers.length > 0 && (
          <> · answers {a.phoneNumbers.map((p) => p.e164).join(", ")}</>
        )}
      </p>

      {sp.saved && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Saved. The next call uses this.
        </p>
      )}
      {rejected.length > 0 && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">Not saved:</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-red-800 dark:text-red-300">
            {rejected.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {current.length > 0 && rejected.length === 0 && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
            This assistant cannot answer a call yet:
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-900 dark:text-amber-300">
            {current.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {promised.length > 0 && (
        <p className="mt-4 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          The prompt mentions{" "}
          <span className="font-mono">{promised.join(", ")}</span>, which{" "}
          {promised.length === 1 ? "is" : "are"} not attached. The agent will describe{" "}
          {promised.length === 1 ? "it" : "them"} and never do{" "}
          {promised.length === 1 ? "it" : "them"}.
        </p>
      )}

      <form action={saveAssistant} className="mt-6 flex flex-col gap-6">
        <input type="hidden" name="id" value={a.id} />
        <input type="hidden" name="key" value={a.key} />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            Display name
            <input name="name" defaultValue={a.name} className={input} />
          </label>
          <label className={label}>
            Status
            <select name="status" defaultValue={a.status} className={input}>
              <option value="TEMPLATE">template — not answering</option>
              <option value="PRODUCTION">production — answers real calls</option>
              <option value="RETIRED">retired — must never answer</option>
            </select>
          </label>
        </div>

        <label className={label}>
          Greeting
          <span className={hint}>The first thing a caller hears.</span>
          <textarea name="greeting" defaultValue={a.greeting} rows={2} className={input} />
        </label>

        <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" name="recordsCall" defaultChecked={a.recordsCall} />
            Record calls
          </label>
          <label className={`${label} mt-3`}>
            Recording notice
            <span className={hint}>
              Appended to the greeting. It must say <em>why</em> — consent is implied by the
              caller continuing, and that only holds if they were told the reason.
            </span>
            <input
              name="recordingNotice"
              defaultValue={a.recordingNotice ?? ""}
              placeholder="This call is recorded so we can book your job accurately."
              className={input}
            />
          </label>
        </div>

        <label className={label}>
          System prompt
          <span className={hint}>
            What the agent is told. If it can book, it needs an explicit &ldquo;you MUST call
            …&rdquo; instruction — without one the model often discusses booking and never
            calls the tool.
          </span>
          <textarea
            name="systemPrompt"
            defaultValue={a.systemPrompt}
            rows={16}
            className={`${input} font-mono text-xs`}
          />
        </label>

        <fieldset className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <legend className="px-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Tools
          </legend>
          <div className="flex flex-col gap-4">
            {TOOL_GROUPS.map((g) => (
              <div key={g.title}>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {g.title}
                </p>
                <p className={hint}>{g.note}</p>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  {g.tools.map((t) => (
                    <label key={t} className="flex items-center gap-2 font-mono text-xs">
                      <input
                        type="checkbox"
                        name="tools"
                        value={t}
                        defaultChecked={a.tools.includes(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
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
                  note: "Config only for now — the voice engine builds ElevenLabs TTS but not Cartesia yet, so a Cartesia voice is stored but will not speak until that adapter ships.",
                },
              ]}
              currentProvider={a.voiceProvider ?? "elevenlabs"}
              currentVoiceId={a.voiceId}
            />
          </div>
          <label className={label}>
            End-call phrases
            <span className={hint}>
              One per line. These fire on the <em>agent&rsquo;s</em> speech, never the
              caller&rsquo;s.
            </span>
            <textarea
              name="endCallPhrases"
              defaultValue={a.endCallPhrases.join("\n")}
              rows={3}
              className={input}
            />
          </label>
          <label className={label}>
            End-call message
            <input name="endCallMessage" defaultValue={a.endCallMessage ?? ""} className={input} />
          </label>
          <label className={label}>
            Transfer to
            <input name="transferTo" defaultValue={a.transferTo ?? ""} className={input} />
          </label>
          <label className={label}>
            Transfer message
            <input
              name="transferMessage"
              defaultValue={a.transferMessage ?? ""}
              className={input}
            />
          </label>
          <label className={label}>
            Silence timeout (seconds)
            <span className={hint}>Blank means no limit — not the same as a default.</span>
            <input
              name="silenceTimeoutSeconds"
              defaultValue={a.silenceTimeoutSeconds ?? ""}
              inputMode="numeric"
              className={input}
            />
          </label>
          <label className={label}>
            Max call duration (seconds)
            <span className={hint}>Blank means no limit.</span>
            <input
              name="maxDurationSeconds"
              defaultValue={a.maxDurationSeconds ?? ""}
              inputMode="numeric"
              className={input}
            />
          </label>
        </div>

        <div>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save
          </button>
        </div>
      </form>

      <section id="contacts" className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Known people</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Numbers the assistant recognises. This is data, not prose in the prompt — a
          &ldquo;known people&rdquo; paragraph with placeholders in it cannot identify anyone,
          and the private tools are gated on the <span className="font-mono">PRINCIPAL</span>{" "}
          entry.
        </p>

        <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {a.contacts.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-mono text-xs">{c.e164}</td>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs">{c.relation}</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {RELATION_NOTE[c.relation]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500">{c.note}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteContact}>
                      <input type="hidden" name="contactId" value={c.id} />
                      <input type="hidden" name="assistantId" value={a.id} />
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {a.contacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-sm text-zinc-500">
                    Nobody yet. Without a PRINCIPAL entry the owner is screened by their own
                    assistant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action={addContact} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="assistantId" value={a.id} />
          <input name="e164" placeholder="+15875551234" required className={input + " w-48"} />
          <input name="name" placeholder="Name" required className={input + " w-40"} />
          <select name="relation" defaultValue="KNOWN" className={input + " w-40"}>
            {Object.keys(RELATION_NOTE).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input name="note" placeholder="note (optional)" className={input + " w-56"} />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add
          </button>
        </form>
      </section>
    </div>
  );
}

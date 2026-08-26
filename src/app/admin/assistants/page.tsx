import Link from "next/link";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAssistant } from "./actions";

export const metadata = { title: "Assistants — Admin" };
export const dynamic = "force-dynamic";

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

/** Status colour carries meaning: only PRODUCTION answers a real line. */
const STATUS_STYLE: Record<string, string> = {
  PRODUCTION: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  TEMPLATE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  RETIRED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function AssistantsPage() {
  await requireEngineer();
  const [assistants, orgs] = await Promise.all([
    prisma.assistant.findMany({
      include: { org: true, phoneNumbers: true, _count: { select: { contacts: true } } },
      orderBy: [{ status: "asc" }, { key: "asc" }],
    }),
    prisma.org.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Assistants
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        What each AI receptionist says, which voice it uses, what it can do, and who it
        recognises. Changes here reach the next call — the voice engine reads this, not a file.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">Assistant</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Numbers</th>
              <th className="px-4 py-2 font-medium">Tools</th>
              <th className="px-4 py-2 font-medium">Known people</th>
              <th className="px-4 py-2 font-medium">Ready?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {assistants.map((a) => {
              // Surfaced in the list because an assistant with no voice cannot answer at
              // all, and that is invisible until someone calls the number.
              const blocked = !a.voiceId
                ? "no voice"
                : a.recordsCall && !a.recordingNotice
                  ? "no recording notice"
                  : null;
              return (
                <tr key={a.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/assistants/${a.id}`}
                      className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {a.name}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-zinc-500">{a.key}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">{a.org.name}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[a.status]}`}
                    >
                      {a.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {a.phoneNumbers.length
                      ? a.phoneNumbers.map((p) => p.e164).join(", ")
                      : <span className="text-zinc-400">none</span>}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {a.tools.length}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {a._count.contacts}
                  </td>
                  <td className="px-4 py-2">
                    {blocked ? (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                        {blocked}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400">ok</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {assistants.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  No assistants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New assistant</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Starts as a template. Making it answer a real line is a separate, deliberate step.
        </p>
        <form action={createAssistant} className="mt-3 flex flex-wrap items-center gap-3">
          <select name="orgId" required className={inputClass}>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <input name="key" placeholder="key (e.g. kelly)" required className={inputClass} />
          <input name="name" placeholder="display name" className={inputClass} />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Create
          </button>
        </form>
      </section>
    </div>
  );
}

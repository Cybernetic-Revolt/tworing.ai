import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";

export const metadata = { title: "Sent log — TwoRing" };

const STATUS_STYLE: Record<string, string> = {
  SENT: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  DELIVERED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  RECEIVED: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  QUEUED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  FAILED: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default async function MessageLogPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const session = await requireSession();
  const { id } = await searchParams;

  const [org, messages] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: session.orgId } }),
    prisma.message.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const tz = org.timezone;
  const selected = id ? messages.find((m) => m.id === id) : null;

  return (
    <div>
      <Link href="/app/messages" className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
        ← Conversations
      </Link>
      <h1 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Sent log
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Every email and text sent or received on your behalf.
      </p>

      {messages.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing yet. Lead summaries and confirmations appear here the moment
          your AI sends them.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
            {messages.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/app/messages/log?id=${m.id}`}
                  className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                    selected?.id === m.id ? "bg-zinc-50 dark:bg-zinc-900" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {m.channel} · {m.direction}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status] ?? ""}`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {m.subject ?? (m.body.slice(0, 60) || "(no subject)")}
                  </div>
                  <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {m.direction === "INBOUND" ? "from" : "to"}{" "}
                    {m.direction === "INBOUND" ? m.fromAddress : m.toAddress} ·{" "}
                    {formatWhen(m.createdAt, tz)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            {selected ? (
              <>
                <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {selected.subject ?? "(no subject)"}
                </h2>
                <dl className="mt-2 grid grid-cols-[5rem_1fr] gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <dt>To</dt>
                  <dd className="text-zinc-700 dark:text-zinc-300">{selected.toAddress}</dd>
                  <dt>From</dt>
                  <dd className="text-zinc-700 dark:text-zinc-300">{selected.fromAddress}</dd>
                  <dt>Sent</dt>
                  <dd className="text-zinc-700 dark:text-zinc-300">{formatWhen(selected.createdAt, tz)}</dd>
                  <dt>Status</dt>
                  <dd className="text-zinc-700 dark:text-zinc-300">
                    {selected.status}
                    {selected.error ? ` — ${selected.error}` : ""}
                  </dd>
                </dl>
                <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-900">
                  {selected.channel === "EMAIL" ? (
                    <div
                      className="text-sm text-zinc-700 dark:text-zinc-300"
                      dangerouslySetInnerHTML={{ __html: selected.body }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                      {selected.body}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Select a message to read it.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

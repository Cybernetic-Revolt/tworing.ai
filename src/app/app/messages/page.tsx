import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Conversations — TwoRing" };

type Latest = {
  threadId: string;
  body: string;
  direction: string;
  template: string | null;
};

export default async function ConversationsPage() {
  const session = await requireSession();
  const [org, threads] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: session.orgId } }),
    prisma.smsThread.findMany({
      where: { orgId: session.orgId },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    }),
  ]);
  const tz = org.timezone;
  const ids = threads.map((t) => t.id);

  // Per-thread (not a global cap): the latest message for the snippet, plus the
  // latest inbound vs latest human reply to decide "needs reply".
  const [latest, lastInbound, lastHuman] = ids.length
    ? await Promise.all([
        prisma.$queryRaw<Latest[]>(Prisma.sql`
          SELECT DISTINCT ON ("threadId") "threadId", "body", "direction", "template"
          FROM "Message"
          WHERE "threadId" IN (${Prisma.join(ids)}) AND "channel" = 'SMS'
          ORDER BY "threadId", "createdAt" DESC, "id" DESC
        `),
        prisma.message.groupBy({
          by: ["threadId"],
          where: { threadId: { in: ids }, channel: "SMS", direction: "INBOUND" },
          _max: { createdAt: true },
        }),
        prisma.message.groupBy({
          by: ["threadId"],
          where: {
            threadId: { in: ids },
            channel: "SMS",
            direction: "OUTBOUND",
            template: "manual-reply",
          },
          _max: { createdAt: true },
        }),
      ])
    : [[], [], []];

  const latestBy = new Map(latest.map((m) => [m.threadId, m]));
  const inboundBy = new Map(
    lastInbound.map((g) => [g.threadId, g._max.createdAt]),
  );
  const humanBy = new Map(lastHuman.map((g) => [g.threadId, g._max.createdAt]));

  function needsReply(id: string): boolean {
    const inb = inboundBy.get(id);
    if (!inb) return false;
    const human = humanBy.get(id);
    return !human || inb > human;
  }
  function snippet(m: Latest | undefined): string {
    if (!m) return "No messages yet";
    const prefix =
      m.direction === "OUTBOUND"
        ? m.template === "manual-reply"
          ? "You: "
          : "Auto: "
        : "";
    return `${prefix}${m.body}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Conversations
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Text conversations with your customers. Reply right from here.
          </p>
        </div>
        <Link
          href="/app/messages/log"
          className="whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400 hover:underline"
        >
          Full sent log →
        </Link>
      </div>

      {threads.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          No conversations yet. When a customer texts your number, the thread
          shows up here.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
          {threads.map((t) => {
            const reply = needsReply(t.id);
            return (
              <li key={t.id}>
                <Link
                  href={`/app/messages/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${reply ? "bg-sky-500" : "bg-transparent"}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${reply ? "font-semibold text-zinc-900 dark:text-zinc-50" : "font-medium text-zinc-800 dark:text-zinc-200"}`}
                      >
                        {t.customerPhone}
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                        {t.lastMessageAt ? formatWhen(t.lastMessageAt, tz) : ""}
                      </span>
                    </div>
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {snippet(latestBy.get(t.id))}
                      {t.consentState === "OPTED_OUT" ? " · opted out" : ""}
                    </div>
                  </div>
                  {reply && (
                    <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      Needs reply
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

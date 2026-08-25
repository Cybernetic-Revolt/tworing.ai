import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { sendReply } from "../actions";

export const metadata = { title: "Conversation — TwoRing" };

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [org, thread] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: session.orgId } }),
    prisma.smsThread.findFirst({ where: { id, orgId: session.orgId } }),
  ]);
  if (!thread) notFound();
  const tz = org.timezone;
  const canReply =
    (session.role === "OWNER" || session.role === "ADMIN") &&
    thread.consentState !== "OPTED_OUT";

  const messages = await prisma.message.findMany({
    where: { orgId: session.orgId, threadId: thread.id, channel: "SMS" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/app/messages" className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
        ← Conversations
      </Link>
      <h1 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {thread.customerPhone}
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {thread.consentState === "OPTED_OUT"
          ? "This customer has opted out — you can't text them until they reply START."
          : "Texts to and from this customer."}
      </p>

      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No messages in this thread yet.</p>
        ) : (
          messages.map((m) => {
            const out = m.direction === "OUTBOUND";
            return (
              <div
                key={m.id}
                className={`flex flex-col ${out ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    out
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
                <span className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                  {formatWhen(m.createdAt, tz)}
                  {out && m.status === "FAILED" ? " · failed" : ""}
                </span>
              </div>
            );
          })
        )}
      </div>

      {canReply ? (
        <form action={sendReply} className="mt-4 flex items-end gap-2">
          <input type="hidden" name="threadId" value={thread.id} />
          <textarea
            name="body"
            required
            rows={2}
            maxLength={1000}
            placeholder="Type a reply…"
            className="flex-1 resize-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Send
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {thread.consentState === "OPTED_OUT"
            ? "Replies are disabled while this customer is opted out."
            : "You don't have permission to reply."}
        </p>
      )}
    </div>
  );
}

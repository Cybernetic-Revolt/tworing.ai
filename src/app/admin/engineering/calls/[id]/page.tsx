import { cleanSummary } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The end-of-call report exactly as it arrived, for any client.
 *
 * Kept raw on purpose: the platform models the fields it understands, and this is where the
 * ones it does not go. When something is wrong with a call, the modelled view is the thing
 * under suspicion — so the unmodelled original is what you need.
 */
export default async function RawCallPage({ params }: { params: Promise<{ id: string }> }) {
  await requireEngineer();
  const { id } = await params;

  const call = await prisma.call.findUnique({
    where: { id },
    include: { org: true },
  });
  if (!call) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/admin/engineering" className="text-sm text-zinc-500 hover:underline">
        ← Engineering
      </Link>
      <h1 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Call {call.id}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {call.org.name} · {call.startedAt.toISOString()}
        {call.disposition && <> · {call.disposition}</>}
        {call.durationSec != null && <> · {call.durationSec}s</>}
        {call.endedReason && <> · ended: {call.endedReason}</>}
      </p>

      {call.recordingUrl && (
        <div className="mt-4">
          <audio controls preload="none" src={call.recordingUrl} className="w-full max-w-md" />
        </div>
      )}

      {call.summary && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Summary</h2>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{cleanSummary(call.summary)}</p>
        </section>
      )}

      {call.transcript && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Transcript</h2>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900">
            {call.transcript}
          </pre>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Raw end-of-call report
        </h2>
        <pre className="mt-2 max-h-[32rem] overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
          {call.raw ? JSON.stringify(call.raw, null, 2) : "none stored"}
        </pre>
      </section>
    </div>
  );
}

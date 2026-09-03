import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RecordingPlayer } from "../recording-player";
import { formatEndedReason, cleanSummary, formatDuration, formatWhen } from "@/lib/format";
import { blockNumber } from "../../blocked/actions";
import { deleteCall } from "../actions";

const OUTCOME_STYLES: Record<string, string> = {
  BOOKED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  RESCHEDULED: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  CANCELLED: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  MESSAGE: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  INQUIRY: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  MISSED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};
const OUTCOME_LABELS: Record<string, string> = {
  BOOKED: "Booked",
  RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled",
  MESSAGE: "Message",
  INQUIRY: "Inquiry",
  MISSED: "Missed",
};

export default async function CallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const [org, call] = await Promise.all([
    prisma.org.findUnique({ where: { id: session.orgId } }),
    prisma.call.findFirst({
      where: { id, orgId: session.orgId },
      include: { lead: true },
    }),
  ]);
  if (!call) notFound();
  const tz = org?.timezone ?? "America/Edmonton";
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";
  const blocked = call.callerNumber
    ? await prisma.blockedNumber.findFirst({
        where: { orgId: session.orgId, e164: call.callerNumber },
      })
    : null;

  return (
    <div>
      <Link
        href="/app/calls"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All calls
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {call.lead?.name ?? call.callerName ?? call.callerNumber ?? "Unknown caller"}
            </h1>
            {call.disposition && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_STYLES[call.disposition]}`}
              >
                {OUTCOME_LABELS[call.disposition]}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {call.callerNumber ? `${call.callerNumber} · ` : ""}
            {formatWhen(call.startedAt, tz)} · {formatDuration(call.durationSec)}
            {formatEndedReason(call.endedReason) ? ` · ${formatEndedReason(call.endedReason)}` : ""}
          </p>
        </div>
        {canEdit && call.callerNumber && !blocked && (
          <form action={blockNumber}>
            <input type="hidden" name="e164" value={call.callerNumber} />
            <input type="hidden" name="reason" value="Blocked from call log" />
            <input type="hidden" name="returnTo" value={`/app/calls/${call.id}`} />
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-950"
            >
              Block this caller
            </button>
          </form>
        )}
        {blocked && (
          <span className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
            Caller blocked
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Summary
            </h2>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              {cleanSummary(call.summary) ?? "No summary."}
            </p>
          </section>
          <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Transcript
            </h2>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-zinc-700 dark:text-zinc-300">
              {call.transcript ?? "No transcript."}
            </pre>
          </section>
        </div>

        <div>
          {call.recordingUrl && (
            <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Recording
              </h2>
              <RecordingPlayer src={call.recordingUrl} label="Call recording" />
            </section>
          )}
          <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 first:mt-0 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Lead
            </h2>
            {call.lead ? (
              <dl className="mt-3 space-y-2 text-sm">
                {(
                  [
                    ["Name", call.lead.name],
                    ["Phone", call.lead.phone],
                    ["Email", call.lead.email],
                    ["Job", call.lead.jobType],
                    ["Address", call.lead.address],
                    ["Urgency", call.lead.urgency],
                    ["Status", call.lead.status],
                  ] as const
                )
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-zinc-500 dark:text-zinc-400">{k}</dt>
                      <dd className="text-right text-zinc-800 dark:text-zinc-200">
                        {v}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No lead captured from this call.
              </p>
            )}
          </section>

          {(session.role === "OWNER" || session.role === "ADMIN") && (
            <section className="rounded-xl border border-red-200 bg-white p-5 dark:border-red-900 dark:bg-zinc-950">
              <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
                Delete this call
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Removes the transcript, summary and recording link permanently. Any
                appointment booked on this call is kept — deleting the record does not
                cancel the work.
              </p>
              <form action={deleteCall} className="mt-3">
                <input type="hidden" name="id" value={call.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Delete call
                </button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

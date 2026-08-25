import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDuration, formatWhen } from "@/lib/format";
import { CallDisposition, Prisma } from "@/generated/prisma/client";
import { RecordingCell } from "./recording-cell";

const FILTERS = [
  "ALL",
  "BOOKED",
  "RESCHEDULED",
  "CANCELLED",
  "MESSAGE",
  "INQUIRY",
  "MISSED",
] as const;

// Each outcome reads at a glance with its own colour.
const OUTCOME_STYLES: Record<string, string> = {
  BOOKED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  RESCHEDULED: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  CANCELLED: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  MESSAGE: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  INQUIRY: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  MISSED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const LABELS: Record<string, string> = {
  BOOKED: "Booked",
  RESCHEDULED: "Rescheduled",
  CANCELLED: "Cancelled",
  MESSAGE: "Message",
  INQUIRY: "Inquiry",
  MISSED: "Missed",
};

export default async function CallLogPage({
  searchParams,
}: {
  searchParams: Promise<{ outcome?: string }>;
}) {
  const session = await requireSession();
  const { outcome } = await searchParams;
  const active = (FILTERS as readonly string[]).includes(outcome ?? "")
    ? outcome!
    : "ALL";

  const where: Prisma.CallWhereInput = {
    orgId: session.orgId,
    ...(active !== "ALL"
      ? { disposition: active as CallDisposition }
      : {}),
  };

  const [org, calls, counts] = await Promise.all([
    prisma.org.findUnique({ where: { id: session.orgId } }),
    prisma.call.findMany({
      where,
      orderBy: { startedAt: "desc" },
      take: 200,
      include: { lead: { select: { id: true, name: true } } },
    }),
    prisma.call.groupBy({
      by: ["disposition"],
      where: { orgId: session.orgId },
      _count: true,
    }),
  ]);
  const tz = org?.timezone ?? "America/Edmonton";
  const countFor = (f: string) =>
    f === "ALL"
      ? counts.reduce((n, c) => n + c._count, 0)
      : counts.find((c) => c.disposition === f)?._count ?? 0;

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Calls
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Every call your receptionist handled — what the caller wanted and how it
        was resolved.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = f === active;
          const href = f === "ALL" ? "/app/calls" : `/app/calls?outcome=${f}`;
          return (
            <Link
              key={f}
              href={href}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isActive
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {f === "ALL" ? "All" : LABELS[f]}
              <span className="ml-1.5 opacity-60">{countFor(f)}</span>
            </Link>
          );
        })}
      </div>

      {calls.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          {active === "ALL"
            ? "No calls yet — they appear here as soon as your AI receptionist answers one."
            : `No ${LABELS[active].toLowerCase()} calls.`}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Caller</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Summary</th>
                <th className="px-4 py-3 font-medium">Recording</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {calls.map((call) => (
                <tr
                  key={call.id}
                  className="text-zinc-800 [&>td]:align-top dark:text-zinc-300"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/app/calls/${call.id}`}
                      className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {formatWhen(call.startedAt, tz)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {call.lead?.name ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {call.lead.name}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {call.callerNumber}
                        </span>
                      </div>
                    ) : (
                      call.callerName ?? call.callerNumber ?? "Unknown"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDuration(call.durationSec)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {call.disposition ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_STYLES[call.disposition]}`}
                      >
                        {LABELS[call.disposition]}
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="min-w-[18rem] max-w-md px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {call.summary ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {call.recordingUrl ? (
                      <RecordingCell
                        src={call.recordingUrl}
                        label={`Play recording of call with ${call.lead?.name ?? call.callerNumber ?? "caller"} on ${formatWhen(call.startedAt, tz)}`}
                      />
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {calls.length === 200 && (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Showing the 200 most recent of {countFor(active)} calls.
        </p>
      )}
    </div>
  );
}

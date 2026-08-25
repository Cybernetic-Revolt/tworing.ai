import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { addLeadNote, setLeadStatus } from "../actions";

const PIPELINE = ["NEW", "CONTACTED", "QUOTED", "BOOKED", "DONE"] as const;

const STATUS_STYLE: Record<string, string> = {
  NEW: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  CONTACTED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  QUOTED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  BOOKED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  DONE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  LOST: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function activityLine(kind: string, payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  switch (kind) {
    case "STATUS_CHANGE":
      return p.from
        ? `Status ${p.from} → ${p.to ?? "?"}`
        : `Lead captured (${p.to ?? "NEW"})`;
    case "NOTE":
      return String(p.text ?? "");
    case "APPOINTMENT":
      return "Appointment booked";
    case "EMAIL":
      return `Email sent${p.subject ? `: ${p.subject}` : ""}`;
    case "SMS":
      return "SMS sent";
    default:
      return kind;
  }
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [org, lead] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: session.orgId } }),
    prisma.lead.findFirst({
      where: { id, orgId: session.orgId },
      include: {
        calls: {
          select: { id: true },
          orderBy: { startedAt: "desc" },
          take: 1,
        },
        appointments: {
          select: { id: true, title: true, startsAt: true, status: true },
          orderBy: { startsAt: "asc" },
        },
        activity: { orderBy: { createdAt: "desc" } },
      },
    }),
  ]);
  if (!lead) notFound();

  const tz = org.timezone;
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";

  return (
    <div className="max-w-2xl">
      <Link href="/app/leads" className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
        ← Leads
      </Link>
      <div className="mt-2 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {lead.name ?? lead.phone}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[lead.status]}`}
        >
          {lead.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Captured {formatWhen(lead.createdAt, tz)}
        {lead.calls[0] && (
          <>
            {" · "}
            <Link href={`/app/calls/${lead.calls[0].id}`} className="text-emerald-600 dark:text-emerald-400 hover:underline">
              view the call
            </Link>
          </>
        )}
      </p>

      {/* Pipeline */}
      {canEdit && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Move through the pipeline
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PIPELINE.map((st) => (
              <form key={st} action={setLeadStatus}>
                <input type="hidden" name="id" value={lead.id} />
                <input type="hidden" name="status" value={st} />
                <button
                  type="submit"
                  disabled={lead.status === st}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    lead.status === st
                      ? `${STATUS_STYLE[st]} cursor-default`
                      : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  {st}
                </button>
              </form>
            ))}
            {lead.status !== "LOST" && (
              <form action={setLeadStatus}>
                <input type="hidden" name="id" value={lead.id} />
                <input type="hidden" name="status" value="LOST" />
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:hover:bg-red-950"
                >
                  Mark lost
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Details */}
      <dl className="mt-6 grid grid-cols-[7rem_1fr] gap-y-2 text-sm text-zinc-800 dark:text-zinc-200">
        <dt className="text-zinc-500 dark:text-zinc-400">Phone</dt>
        <dd>{lead.phone}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
        <dd>{lead.email ?? "—"}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Job</dt>
        <dd>{lead.jobType ?? "—"}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Address</dt>
        <dd>{lead.address ?? "—"}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Urgency</dt>
        <dd>{lead.urgency ?? "—"}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Message</dt>
        <dd className="whitespace-pre-wrap">{lead.notes ?? "—"}</dd>
      </dl>

      {lead.appointments.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Appointments
          </h2>
          <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white text-sm dark:divide-zinc-900 dark:border-zinc-800 dark:bg-zinc-950">
            {lead.appointments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/app/calendar/${a.id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span>
                    {formatWhen(a.startsAt, tz)} — {a.title}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">{a.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Activity timeline */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Activity
        </h2>
        {canEdit && (
          <form action={addLeadNote} className="mt-3 flex gap-2">
            <input type="hidden" name="id" value={lead.id} />
            <input
              name="text"
              placeholder="Add a note…"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Add
            </button>
          </form>
        )}
        {lead.activity.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No activity yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3 border-l border-zinc-200 pl-4 dark:border-zinc-800">
            {lead.activity.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">
                  {activityLine(a.kind, a.payload)}
                </span>
                <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                  {a.actor === "USER" ? "You" : a.actor} ·{" "}
                  {formatWhen(a.createdAt, tz)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

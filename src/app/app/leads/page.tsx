import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { LeadStatus, Prisma } from "@/generated/prisma/client";

const FILTERS = ["ALL", "NEW", "CONTACTED", "QUOTED", "BOOKED", "DONE", "LOST"] as const;

// Status colours so a NEW lead doesn't read the same as a BOOKED one.
const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  CONTACTED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  QUOTED: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  BOOKED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  DONE: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  LOST: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const { status } = await searchParams;
  const active = (FILTERS as readonly string[]).includes(status ?? "")
    ? status!
    : "ALL";

  const where: Prisma.LeadWhereInput = {
    orgId: session.orgId,
    ...(active !== "ALL" ? { status: active as LeadStatus } : {}),
  };

  const [org, leads] = await Promise.all([
    prisma.org.findUnique({ where: { id: session.orgId } }),
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const tz = org?.timezone ?? "America/Edmonton";

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Leads
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Every caller your receptionist captured.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = f === active;
          const href = f === "ALL" ? "/app/leads" : `/app/leads?status=${f}`;
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
              {f === "ALL" ? "All" : f}
            </Link>
          );
        })}
      </div>

      {leads.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
          {active === "ALL" ? "No leads yet." : `No ${active.toLowerCase()} leads.`}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Urgency</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {leads.map((lead) => (
                <tr key={lead.id} className="text-zinc-800 dark:text-zinc-200">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {formatWhen(lead.createdAt, tz)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/app/leads/${lead.id}`}
                      className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {lead.name ?? (
                        <span className="italic text-zinc-400 dark:text-zinc-500">Unknown caller</span>
                      )}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{lead.phone}</td>
                  <td className="px-4 py-3">{lead.jobType ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {lead.urgency ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[lead.status] ?? STATUS_STYLES.NEW}`}
                    >
                      {lead.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

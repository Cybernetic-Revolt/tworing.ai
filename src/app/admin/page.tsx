import Link from "next/link";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOrg } from "./actions";

const tierBadge: Record<string, string> = {
  ANSWER: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  OFFICE: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  OPERATIONS:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  CUSTOM: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const errors: Record<string, string> = {
  missing: "Name and slug are required.",
  slug: "That slug is already taken.",
};

const inputClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireEngineer();
  const { error } = await searchParams;

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [orgs, recentCalls] = await Promise.all([
    prisma.org.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        _count: {
          select: { members: true, phoneNumbers: true, calls: true, leads: true },
        },
      },
    }),
    prisma.call.groupBy({
      by: ["orgId"],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const calls30 = new Map(recentCalls.map((r) => [r.orgId, r._count._all]));

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Clients
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {orgs.length} organization{orgs.length === 1 ? "" : "s"} on the platform
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Numbers</th>
              <th className="px-4 py-3">Calls (30d)</th>
              <th className="px-4 py-3">Calls (all)</th>
              <th className="px-4 py-3">Leads</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orgs/${org.id}`}
                    className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                  >
                    {org.name}
                  </Link>
                  <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">{org.slug}</span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierBadge[org.tier] ?? tierBadge.ANSWER}`}
                  >
                    {org.tier}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {org._count.members}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {org._count.phoneNumbers}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {calls30.get(org.id) ?? 0}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {org._count.calls}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                  {org._count.leads}
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400 dark:text-zinc-500">
                  No clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-10 max-w-lg">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          New client
        </h2>
        {error && errors[error] && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errors[error]}
          </p>
        )}
        <form action={createOrg} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="name" placeholder="Business name" required className={inputClass} />
            <input
              name="slug"
              placeholder="slug (e.g. acme-plumbing)"
              required
              pattern="[a-z0-9-]+"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select name="tier" defaultValue="ANSWER" className={inputClass}>
              <option value="ANSWER">Answer — $179</option>
              <option value="OFFICE">Office — $349</option>
              <option value="OPERATIONS">Operations — $599</option>
              <option value="CUSTOM">Custom</option>
            </select>
            <input
              name="notifyEmail"
              type="email"
              placeholder="Lead-summary email"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Create client
          </button>
        </form>
      </div>
    </div>
  );
}

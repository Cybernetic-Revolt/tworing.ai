import Link from "next/link";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "Engineering — Admin" };
export const dynamic = "force-dynamic";

/**
 * Cross-organisation diagnostics.
 *
 * This replaces the engineering page that lived inside the customer portal. That one was
 * gated to staff but scoped to `session.orgId`, so it could only ever show whichever
 * organisation the engineer's own user happened to belong to — never the client they were
 * actually debugging. Platform staff are not a tenant, and the tools they need are not a
 * page inside one tenant's product.
 */
export default async function EngineeringPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  await requireEngineer();
  const { org: orgFilter } = await searchParams;

  const [orgs, numbers, keys, googles, calls, counts] = await Promise.all([
    prisma.org.findMany({ orderBy: { name: "asc" } }),
    prisma.phoneNumber.findMany({
      include: { org: true, assistant: true },
      orderBy: { e164: "asc" },
    }),
    prisma.ingestKey.findMany({ include: { org: true }, orderBy: { createdAt: "desc" } }),
    prisma.googleConnection.findMany({ include: { org: true } }),
    prisma.call.findMany({
      where: orgFilter ? { orgId: orgFilter } : {},
      include: { org: true },
      orderBy: { startedAt: "desc" },
      take: 40,
    }),
    prisma.call.groupBy({ by: ["orgId"], _count: { _all: true } }),
  ]);

  const callCount = new Map(counts.map((c) => [c.orgId, c._count._all]));
  const googleByOrg = new Map(googles.map((g) => [g.orgId, g]));
  const mono = "font-mono text-xs";
  const card = "rounded-lg border border-zinc-200 dark:border-zinc-800";
  const th =
    "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
  const td = "px-3 py-2";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Engineering
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Every client, not just one. Numbers and their routing, ingest keys, calendar
        connections, and recent calls across the estate.
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Clients</h2>
        <div className={`mt-2 overflow-x-auto ${card}`}>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className={th}>Client</th>
                <th className={th}>Tier</th>
                <th className={th}>Timezone</th>
                <th className={th}>Calls</th>
                <th className={th}>Google</th>
                <th className={th}>Ingest keys</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {orgs.map((o) => {
                const g = googleByOrg.get(o.id);
                return (
                  <tr key={o.id}>
                    <td className={td}>
                      <Link
                        href={`/admin/orgs/${o.id}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {o.name}
                      </Link>
                      <span className={`ml-2 ${mono} text-zinc-500`}>{o.slug}</span>
                    </td>
                    <td className={`${td} ${mono}`}>{o.tier}</td>
                    <td className={`${td} ${mono} text-zinc-500`}>{o.timezone}</td>
                    <td className={`${td} tabular-nums`}>
                      <Link href={`/admin/engineering?org=${o.id}`} className="hover:underline">
                        {callCount.get(o.id) ?? 0}
                      </Link>
                    </td>
                    <td className={td}>
                      {g ? (
                        <span
                          className={
                            g.syncEnabled
                              ? "text-xs text-emerald-700 dark:text-emerald-400"
                              : "text-xs text-amber-700 dark:text-amber-400"
                          }
                        >
                          {g.syncEnabled ? "connected" : "sync off"}
                          {g.lastError && " · error"}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">not connected</span>
                      )}
                    </td>
                    <td className={`${td} tabular-nums text-zinc-600 dark:text-zinc-400`}>
                      {keys.filter((k) => k.orgId === o.id).length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Numbers and routing
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          A number with no assistant reaches the fallback greeting, not a receptionist.
        </p>
        <div className={`mt-2 overflow-x-auto ${card}`}>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className={th}>Number</th>
                <th className={th}>Client</th>
                <th className={th}>Carrier</th>
                <th className={th}>Answers as</th>
                <th className={th}>Failover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {numbers.map((n) => (
                <tr key={n.id}>
                  <td className={`${td} ${mono}`}>{n.e164}</td>
                  <td className={`${td} text-zinc-600 dark:text-zinc-400`}>{n.org.name}</td>
                  <td className={`${td} ${mono} text-zinc-500`}>
                    {n.provider}
                    {n.sipSubaccount && ` · ${n.sipSubaccount}`}
                  </td>
                  <td className={td}>
                    {n.assistant ? (
                      <Link
                        href={`/admin/assistants/${n.assistant.id}`}
                        className={`${mono} underline-offset-2 hover:underline`}
                      >
                        {n.assistant.key}
                      </Link>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        no assistant
                      </span>
                    )}
                  </td>
                  <td className={`${td} ${mono} text-zinc-500`}>{n.failoverE164 ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Recent calls{orgFilter && " (filtered)"}
        </h2>
        {orgFilter && (
          <Link href="/admin/engineering" className="text-xs text-zinc-500 hover:underline">
            clear filter
          </Link>
        )}
        <div className={`mt-2 overflow-x-auto ${card}`}>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className={th}>When</th>
                <th className={th}>Client</th>
                <th className={th}>Caller</th>
                <th className={th}>Disposition</th>
                <th className={th}>Recording</th>
                <th className={th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {calls.map((c) => (
                <tr key={c.id}>
                  <td className={`${td} ${mono} text-zinc-500`}>
                    {c.startedAt.toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                  <td className={`${td} text-zinc-600 dark:text-zinc-400`}>{c.org.name}</td>
                  <td className={`${td} ${mono} text-zinc-500`}>{c.callerNumber ?? "—"}</td>
                  <td className={`${td} ${mono}`}>{c.disposition ?? "—"}</td>
                  <td className={td}>
                    {c.recordingUrl ? (
                      <span className="text-xs text-emerald-700 dark:text-emerald-400">yes</span>
                    ) : (
                      <span className="text-xs text-zinc-400">none</span>
                    )}
                  </td>
                  <td className={`${td} text-right`}>
                    <Link
                      href={`/admin/engineering/calls/${c.id}`}
                      className="text-xs underline-offset-2 hover:underline"
                    >
                      raw
                    </Link>
                  </td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-500">
                    No calls recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

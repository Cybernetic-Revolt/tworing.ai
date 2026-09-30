import Link from "next/link";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { ConfirmButton } from "../confirm-button";
import { addPoolNumbers, removePoolNumber } from "./actions";

export const metadata = { title: "Number pool — TwoRing Admin" };

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function pretty(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export default async function NumberPoolPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; error?: string }>;
}) {
  await requireEngineer();
  const { added, error } = await searchParams;

  const pool = await prisma.numberPool.findMany({ orderBy: { createdAt: "asc" } });
  const orgs = await prisma.org.findMany({ select: { id: true, name: true, slug: true } });
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const free = pool.filter((n) => !n.claimedByOrgId);

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Number pool
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Spare DIDs held ready so a self-serve signup is answering calls a minute later. When
        this runs dry, new trials get an account with no phone line and you get told to assign
        one by hand.
      </p>

      <div
        className={`mt-4 rounded-xl border p-4 text-sm ${
          free.length === 0
            ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
            : free.length <= 2
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        }`}
      >
        <strong>
          {free.length} number{free.length === 1 ? "" : "s"} available
        </strong>
        {free.length === 0
          ? " — the next signup will not get a line. Buy DIDs at VoIP.ms and paste them below."
          : free.length <= 2
            ? " — running low. Worth topping up before you advertise."
            : ` of ${pool.length} in the pool.`}
      </div>

      {added && (
        <p className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Added {added} number{added === "1" ? "" : "s"} (duplicates skipped).
        </p>
      )}
      {error === "parse" && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Couldn&apos;t read a phone number in that. Paste 10-digit or +1 numbers.
        </p>
      )}

      <form
        action={addPoolNumbers}
        className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Add numbers</h2>
        <label className="mt-3 block text-sm text-zinc-700 dark:text-zinc-300">
          Numbers
          <textarea
            name="numbers"
            rows={3}
            required
            placeholder="4035551234, 5875550100&#10;4035559876"
            className={`${inputClass} mt-1 font-mono`}
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            SIP subaccount
            <input name="sipSubaccount" placeholder="100000_sub" className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-sm text-zinc-700 dark:text-zinc-300">
            Note
            <input name="note" placeholder="Calgary batch, Sep" className={`${inputClass} mt-1`} />
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Add to pool
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Subaccount</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {pool.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  The pool is empty.
                </td>
              </tr>
            )}
            {pool.map((n) => {
              const org = n.claimedByOrgId ? orgById.get(n.claimedByOrgId) : undefined;
              return (
                <tr key={n.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {pretty(n.e164)}
                  </td>
                  <td className="px-4 py-3">
                    {org ? (
                      <Link href={`/admin/orgs/${org.id}`} className="text-emerald-700 hover:underline dark:text-emerald-400">
                        {org.name}
                      </Link>
                    ) : n.claimedByOrgId ? (
                      <span className="text-zinc-500">claimed</span>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400">available</span>
                    )}
                    {n.claimedAt && (
                      <span className="ml-2 text-xs text-zinc-400">
                        {formatWhen(n.claimedAt, "America/Edmonton")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {n.sipSubaccount ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{n.note ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {!n.claimedByOrgId && (
                      <form action={removePoolNumber}>
                        <input type="hidden" name="id" value={n.id} />
                        <ConfirmButton
                          className="text-red-600 hover:underline dark:text-red-400"
                          confirm={`Remove ${pretty(n.e164)} from the pool?`}
                        >
                          Remove
                        </ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

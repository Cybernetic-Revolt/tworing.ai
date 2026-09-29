import Link from "next/link";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { ConfirmButton } from "../confirm-button";
import { deleteSignup, setSignupHandled } from "./actions";

export const metadata = { title: "Trial requests — TwoRing Admin" };

/** +15875550100 → (587) 555-0100; anything else is shown as-is. */
function prettyPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : raw;
}

export default async function AdminSignupsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireEngineer();
  const { deleted } = await searchParams;

  const signups = await prisma.signup.findMany({ orderBy: { createdAt: "desc" } });

  // Which of these already became clients. Matched on the owner's email first (exact, and
  // what the trial email is sent to) then on business name, so a handled row is obvious
  // even when it was never ticked.
  const orgs = await prisma.org.findMany({
    select: { id: true, slug: true, name: true, members: { select: { user: { select: { email: true } } } } },
  });
  // The admin org route keys on the row id, not the slug; the slug is only for display.
  const byEmail = new Map<string, { id: string; slug: string }>();
  const byName = new Map<string, { id: string; slug: string }>();
  for (const o of orgs) {
    byName.set(o.name.toLowerCase(), { id: o.id, slug: o.slug });
    for (const m of o.members) byEmail.set(m.user.email.toLowerCase(), { id: o.id, slug: o.slug });
  }
  const existingOrg = (s: { email: string; business: string }) =>
    byEmail.get(s.email.toLowerCase()) ?? byName.get(s.business.toLowerCase());

  const open = signups.filter((s) => !s.handled && !existingOrg(s));

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Trial requests
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {open.length === 0
            ? "Nothing waiting."
            : `${open.length} waiting on you`}
          {signups.length > 0 && ` · ${signups.length} total`}
        </p>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Everyone who asked for a trial at tworing.ai/start. The row is saved before the
        notification email is sent, so a prospect appears here even if the email never arrived.
      </p>

      {deleted && (
        <p className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Deleted.
        </p>
      )}

      {signups.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No trial requests yet.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {signups.map((s) => {
            const org = existingOrg(s);
            const done = s.handled || !!org;
            return (
              <div
                key={s.id}
                className={`rounded-xl border p-4 ${
                  done
                    ? "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40"
                    : "border-emerald-200 bg-white dark:border-emerald-900 dark:bg-zinc-950"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
                    {s.business}
                    {org && (
                      <Link
                        href={`/admin/orgs/${org.id}`}
                        className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:underline dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        client · {org.slug}
                      </Link>
                    )}
                    {!org && s.handled && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        handled
                      </span>
                    )}
                  </h2>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {formatWhen(s.createdAt, "America/Edmonton")}
                  </span>
                </div>

                <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <p className="text-zinc-700 dark:text-zinc-300">{s.name}</p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <a href={`tel:${s.phone}`} className="hover:underline">
                      {prettyPhone(s.phone)}
                    </a>
                  </p>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    <a href={`mailto:${s.email}`} className="hover:underline">
                      {s.email}
                    </a>
                  </p>
                  <p className="text-zinc-500 dark:text-zinc-400">
                    {[s.trade, s.city].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {s.notes && (
                  <p className="mt-2 whitespace-pre-wrap rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    {s.notes}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <form action={setSignupHandled}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="handled" value={s.handled ? "0" : "1"} />
                    <button
                      type="submit"
                      className="text-zinc-600 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      {s.handled ? "Mark as waiting" : "Mark as handled"}
                    </button>
                  </form>
                  <a
                    href={`mailto:${s.email}?subject=${encodeURIComponent("Your TwoRing trial")}`}
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Email them
                  </a>
                  <form action={deleteSignup} className="ml-auto">
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton
                      className="text-red-600 hover:underline dark:text-red-400"
                      confirm={`Delete the trial request from ${s.business}? This is the only record of them asking.`}
                    >
                      Delete
                    </ConfirmButton>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

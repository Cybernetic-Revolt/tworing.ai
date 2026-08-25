import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatWhen } from "@/lib/format";
import { SettingsTabs } from "../settings-tabs";
import { changePassword } from "./actions";
import { blockNumber, unblockNumber } from "../blocked/actions";

export const metadata = { title: "Account — TwoRing" };

const messages: Record<string, string> = {
  current: "Your current password is incorrect.",
  weak: "New password must be at least 10 characters.",
  mismatch: "New password and confirmation don't match.",
  number: "Enter a valid phone number to block.",
};

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireSession();
  const { error, success } = await searchParams;
  const [org, blocked] = await Promise.all([
    prisma.org.findUnique({ where: { id: session.orgId } }),
    prisma.blockedNumber.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const tz = org?.timezone ?? "America/Edmonton";
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";

  return (
    <div className="max-w-2xl">
      <SettingsTabs />
      <div className="max-w-md">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Account
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{session.email}</p>

      <h2 className="mt-8 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Your data
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Download everything we hold for your business — it&apos;s yours, anytime.
      </p>
      <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        {[
          { type: "calls", label: "Calls & transcripts" },
          { type: "leads", label: "Leads" },
          { type: "appointments", label: "Appointments" },
        ].map((d) => (
          <div
            key={d.type}
            className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 text-sm last:border-0 dark:border-zinc-900"
          >
            <span className="text-zinc-700 dark:text-zinc-300">{d.label}</span>
            <span className="flex gap-3">
              <a
                href={`/api/export?type=${d.type}&format=csv`}
                className="text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                CSV
              </a>
              <a
                href={`/api/export?type=${d.type}&format=json`}
                className="text-zinc-500 dark:text-zinc-400 hover:underline"
              >
                JSON
              </a>
            </span>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Blocked callers
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Spam and nuisance numbers you never want your receptionist to spend a
        minute on.
      </p>
      {canEdit && (
        <form action={blockNumber} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="returnTo" value="/app/account" />
          <input
            name="e164"
            placeholder="Phone number"
            className={`${inputClass} flex-1`}
          />
          <input
            name="reason"
            placeholder="Reason (optional)"
            className={`${inputClass} flex-1`}
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Block
          </button>
        </form>
      )}
      {blocked.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No blocked numbers.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-200 text-sm dark:divide-zinc-900 dark:border-zinc-800">
          {blocked.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {b.e164}
                </span>
                {b.reason && (
                  <span className="text-zinc-500 dark:text-zinc-400"> — {b.reason}</span>
                )}
                <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                  blocked {formatWhen(b.createdAt, tz)}
                </span>
              </span>
              {canEdit && (
                <form action={unblockNumber}>
                  <input type="hidden" name="id" value={b.id} />
                  <button type="submit" className="shrink-0 text-zinc-500 dark:text-zinc-400 hover:underline">
                    Unblock
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Change password
      </h2>
      {error && messages[error] && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {messages[error]}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Password updated.
        </p>
      )}
      <form action={changePassword} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Current password
          <input
            name="current"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          New password
          <input
            name="next"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Confirm new password
          <input
            name="confirm"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="mt-2 self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Update password
        </button>
      </form>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "../brand";
import { completeReset } from "./actions";

export const metadata = { title: "Set a new password — TwoRing" };

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black";
const inputClass =
  "rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 " +
  FOCUS;

const ERRORS: Record<string, string> = {
  weak: "New password must be at least 10 characters.",
  mismatch: "The two passwords don't match.",
};

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const invalid = !token || error === "invalid";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Link href="/" className={`inline-flex items-center rounded transition-opacity hover:opacity-80 ${FOCUS}`}>
          <Logo />
        </Link>

        {invalid ? (
          <>
            <h1 className="mt-5 font-display text-2xl font-normal leading-tight text-zinc-900 dark:text-zinc-50">
              This link has expired
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Password reset links work once and expire after an hour. Request a
              fresh one and we&apos;ll email it right over.
            </p>
            <Link
              href="/forgot"
              className={`mt-6 block w-full rounded-md bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700 ${FOCUS}`}
            >
              Send a new link
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-5 font-display text-2xl font-normal leading-tight text-zinc-900 dark:text-zinc-50">
              Set a new password
            </h1>
            {error && ERRORS[error] && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {ERRORS[error]}
              </p>
            )}
            <form action={completeReset} className="mt-5 flex flex-col gap-4">
              <input type="hidden" name="token" value={token} />
              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                New password
                <input name="next" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                Confirm new password
                <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
              </label>
              <button
                type="submit"
                className={`mt-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 ${FOCUS}`}
              >
                Update password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "../brand";
import { requestReset } from "./actions";

export const metadata = { title: "Reset password — TwoRing" };

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Link href="/" className={`inline-flex items-center rounded transition-opacity hover:opacity-80 ${FOCUS}`}>
          <Logo />
        </Link>

        {sent ? (
          <>
            <h1 className="mt-5 font-display text-2xl font-normal leading-tight text-zinc-900 dark:text-zinc-50">
              Check your email
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              If an account exists for that address, we&apos;ve sent a link to
              set a new password. It expires in one hour and works once.
            </p>
            <Link
              href="/login"
              className={`mt-6 block w-full rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 ${FOCUS}`}
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-5 font-display text-2xl font-normal leading-tight text-zinc-900 dark:text-zinc-50">
              Reset your password
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <form action={requestReset} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className={`rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${FOCUS}`}
                />
              </label>
              <button
                type="submit"
                className={`mt-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 ${FOCUS}`}
              >
                Send reset link
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Remembered it?{" "}
              <Link href="/login" className={`rounded font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 ${FOCUS}`}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

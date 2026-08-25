import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Logo } from "../brand";
import { login } from "./actions";

export const metadata = { title: "Sign in — TwoRing" };

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black";
const field =
  "rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 " +
  FOCUS;
const accentLink =
  "rounded font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 " +
  FOCUS;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  if (await getSession()) redirect("/app");
  const { error, reset } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Link href="/" className={`inline-flex items-center rounded transition-opacity hover:opacity-80 ${FOCUS}`}>
          <Logo />
        </Link>
        <h1 className="mt-5 font-display text-2xl font-normal leading-tight text-zinc-900 dark:text-zinc-50">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Sign in to your receptionist portal.
        </p>
        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Invalid email or password.
          </p>
        )}
        {reset && (
          <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Password updated — sign in with your new password.
          </p>
        )}
        <form action={login} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
            <input name="email" type="email" required autoComplete="email" className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center justify-between">
              Password
              <Link href="/forgot" className={`text-xs ${accentLink}`}>
                Forgot?
              </Link>
            </span>
            <input name="password" type="password" required autoComplete="current-password" className={field} />
          </label>
          <button
            type="submit"
            className={`mt-1 rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 ${FOCUS}`}
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-xs uppercase tracking-wide text-zinc-400">or</span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <a
          href="/demo"
          className={`mt-6 block w-full rounded-md border border-zinc-300 px-4 py-2.5 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 ${FOCUS}`}
        >
          View live demo
        </a>
        <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Explore a real demo portal — no account needed.
        </p>
        <p className="mt-5 border-t border-zinc-100 pt-5 text-center text-sm text-zinc-500 dark:border-zinc-800/70 dark:text-zinc-400">
          New to TwoRing?{" "}
          <Link href="/start" className={accentLink}>
            Start free →
          </Link>
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Logo } from "../../brand";
import { staffLogin } from "./actions";

export const metadata = { title: "Staff sign-in — TwoRing" };
export const dynamic = "force-dynamic";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const input =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2">
          <Logo markClassName="h-6 w-6" wordmarkClassName="text-base font-semibold" />
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Staff
          </span>
        </div>
        <h1 className="mt-6 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Back office
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          For platform staff. Customers sign in at{" "}
          <Link href="/login" className="underline underline-offset-2">
            the portal
          </Link>
          .
        </p>

        {error === "locked" ? (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Too many attempts. Wait a few minutes and try again.
          </p>
        ) : error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            That didn&rsquo;t work. Check the address and password.
          </p>
        ) : null}

        <form action={staffLogin} className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Email
            <input name="email" type="email" required autoComplete="username" className={input} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={input}
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

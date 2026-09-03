import Link from "next/link";
import { Logo } from "./brand";

/**
 * The branded 404. Before this existed the framework default rendered — a bare
 * "404 | This page could not be found" with no way back into the product, which reads
 * as "the site is broken" to a customer who mistyped a link from an email.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center dark:bg-zinc-950">
      <Logo />
      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        That page isn&rsquo;t here
      </h1>
      <p className="mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        The link may be old, or the page may have moved. Your calls, leads and settings are
        all still where you left them.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/app"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Go to your dashboard
        </Link>
        <Link
          href="/"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          tworing.ai
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { Logo } from "./brand";

// Shared chrome for the privacy & terms pages.
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center rounded transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Logo />
          </Link>
          <Link
            href="/"
            className="rounded text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            ← Back to site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Last updated {updated}</p>
        <div className="legal mt-8 flex flex-col gap-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {children}
        </div>
        <p className="mt-10 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          This is a plain-language starting point provided for transparency. It
          is not legal advice; Bilco Works Inc. will have it reviewed by counsel
          before relying on it in a dispute.
        </p>
      </main>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-50">
      {children}
    </h2>
  );
}

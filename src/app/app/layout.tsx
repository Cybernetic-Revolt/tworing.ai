import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Logo } from "../brand";
import { logout } from "./actions";
import { PortalNav } from "./portal-nav";

export const metadata = { title: "TwoRing" };

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const org = await prisma.org.findUnique({ where: { id: session.orgId } });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-5xl px-4">
          {/* Brand row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/"
                title="Back to tworing.ai"
                className="flex shrink-0 items-center transition-opacity hover:opacity-80"
              >
                <Logo
                  markClassName="h-6 w-6"
                  wordmarkClassName="text-base font-semibold tracking-tight"
                />
              </Link>
              <span
                className="hidden h-5 w-px shrink-0 bg-zinc-200 sm:block dark:bg-zinc-800"
                aria-hidden
              />
              <span className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {org?.name ?? "TwoRing"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-xs text-zinc-400 sm:inline dark:text-zinc-500">
                {session.email}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
          {/* Nav row */}
          <PortalNav engineer={!!session.engineer} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}

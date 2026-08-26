import Link from "next/link";
import { requireEngineer } from "@/lib/auth";
import { Logo } from "../brand";
import { logout } from "../app/actions";

export const metadata = { title: "Admin — TwoRing" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireEngineer();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b-2 border-amber-400 bg-white dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
            >
              <Logo
                markClassName="h-6 w-6"
                wordmarkClassName="text-base font-semibold tracking-tight"
              />
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Admin
              </span>
            </Link>
            <nav className="ml-2 flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              <Link href="/admin" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Clients
              </Link>
              <Link
                href="/admin/assistants"
                className="hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Assistants
              </Link>
              <Link href="/app" className="hover:text-zinc-900 dark:hover:text-zinc-100">
                Portal
              </Link>
            </nav>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Sign out ({session.email})
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The account-area routes stay as siblings under /app/*; this bar gives them a
// single "Settings" home with sub-tabs, so the top nav can stay focused on the
// daily-use views.
const TABS = [
  { href: "/app/settings", label: "Business" },
  { href: "/app/team", label: "Team" },
  { href: "/app/connections", label: "Connections" },
  { href: "/app/account", label: "Account" },
];

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        Settings
      </p>
      <nav
        aria-label="Settings sections"
        className="mt-2 flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800"
      >
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px whitespace-nowrap rounded-t-sm border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                active
                  ? "border-emerald-500 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

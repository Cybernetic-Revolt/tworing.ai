"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; accent?: boolean; match?: string[] };

const ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/calls", label: "Calls" },
  { href: "/app/leads", label: "Leads" },
  { href: "/app/messages", label: "Messages" },
  { href: "/app/captured", label: "Captured" },
  { href: "/app/calendar", label: "Calendar" },
  { href: "/app/reports", label: "Found Money" },
  // Account-area routes are grouped under a single Settings hub (see
  // settings-tabs.tsx); this one entry stays active across all of them.
  {
    href: "/app/settings",
    label: "Settings",
    match: ["/app/settings", "/app/team", "/app/connections", "/app/account"],
  },
];

const ENGINEER_ITEMS: NavItem[] = [
  { href: "/app/engineering", label: "Engineering", accent: true },
  { href: "/admin", label: "Admin", accent: true },
];

// Dashboard (/app) only matches exactly; every other tab also matches its
// detail pages (e.g. /app/calls/[id] keeps "Calls" active).
function matchesPrefix(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/app") return pathname === "/app";
  if (item.match) return item.match.some((h) => matchesPrefix(pathname, h));
  return matchesPrefix(pathname, item.href);
}

export function PortalNav({ engineer }: { engineer: boolean }) {
  const pathname = usePathname();
  const items = engineer ? [...ITEMS, ...ENGINEER_ITEMS] : ITEMS;

  return (
    <nav className="flex gap-5 overflow-x-auto pb-px text-sm">
      {items.map((it) => {
        const active = isActive(pathname, it);
        const color = active
          ? "font-semibold text-emerald-600 dark:text-emerald-400"
          : it.accent
            ? "text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
            : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap py-2 transition-colors ${color}`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

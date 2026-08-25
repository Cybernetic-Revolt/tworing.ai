import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatTimeOnly, localDatePlus, wallTime, zonedToUtc } from "@/lib/tz";
import { formatWhen } from "@/lib/format";
import { OnboardingChecklist, type OnboardingStep } from "./onboarding-checklist";

const TIER_MINUTES: Record<string, number | null> = {
  ANSWER: 400,
  OFFICE: 800,
  OPERATIONS: 1200,
  CUSTOM: null,
};

// +15875550100 → (587) 555-0100; anything else is shown as-is.
function prettyPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export default async function DashboardPage() {
  const session = await requireSession();
  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
  });
  const tz = org.timezone;
  const now = new Date();

  // Org-timezone boundaries
  const today = localDatePlus(now, tz, 0);
  const todayStart = zonedToUtc(today.y, today.mo, today.d, 0, tz);
  const monday = localDatePlus(now, tz, -((today.weekday + 6) % 7));
  const weekStart = zonedToUtc(monday.y, monday.mo, monday.d, 0, tz);
  const wt = wallTime(now, tz);
  const monthStart = zonedToUtc(wt.y, wt.mo, 1, 0, tz);

  const canEdit = session.role === "OWNER" || session.role === "ADMIN";
  const showOnboarding = canEdit && !org.isDemoOrg;

  const [
    callsToday,
    callsWeek,
    monthAgg,
    nextAppts,
    newestLeads,
    callsAllTime,
    hoursCount,
    google,
    firstNumber,
  ] = await Promise.all([
    prisma.call.count({
      where: { orgId: session.orgId, startedAt: { gte: todayStart } },
    }),
    prisma.call.count({
      where: { orgId: session.orgId, startedAt: { gte: weekStart } },
    }),
    prisma.call.aggregate({
      where: { orgId: session.orgId, startedAt: { gte: monthStart } },
      _sum: { durationSec: true },
    }),
    prisma.appointment.findMany({
      where: {
        orgId: session.orgId,
        startsAt: { gte: now },
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      orderBy: { startsAt: "asc" },
      take: 3,
    }),
    prisma.lead.findMany({
      where: { orgId: session.orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Onboarding signals — only queried when the checklist may render.
    showOnboarding
      ? prisma.call.count({ where: { orgId: session.orgId } })
      : Promise.resolve(0),
    showOnboarding
      ? prisma.availabilityRule.count({ where: { orgId: session.orgId } })
      : Promise.resolve(0),
    showOnboarding
      ? prisma.googleConnection.findUnique({ where: { orgId: session.orgId } })
      : Promise.resolve(null),
    showOnboarding
      ? prisma.phoneNumber.findFirst({
          where: { orgId: session.orgId },
          orderBy: { e164: "asc" },
        })
      : Promise.resolve(null),
  ]);

  const onboardingSteps: OnboardingStep[] = [
    {
      label: "Forward your business line",
      help: firstNumber
        ? `Point your number at your TwoRing line, ${prettyPhone(firstNumber.e164)}. Done once your first call lands here.`
        : "Point your business number at your TwoRing line so calls reach your receptionist.",
      href: "/app/calls",
      done: callsAllTime > 0,
    },
    {
      label: "Set your business hours",
      help: "Tell your receptionist when you're open so it books jobs at the right times.",
      href: "/app/calendar/settings",
      done: hoursCount > 0,
    },
    {
      label: "Connect your calendar",
      help: "Sync Google Calendar so bookings appear instantly and never double-book.",
      href: "/app/connections",
      done: !!google?.calendarId,
    },
    {
      label: "Set your average job value",
      help: "Powers your Found Money report — the revenue your receptionist recovers.",
      href: "/app/settings",
      done: org.averageJobValue != null,
    },
  ];

  const minutesUsed = Math.round((monthAgg._sum.durationSec ?? 0) / 60);
  const cap = TIER_MINUTES[org.tier] ?? null;
  const pct = cap ? Math.min(100, Math.round((minutesUsed / cap) * 100)) : null;

  const dayLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const card =
    "rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950";

  return (
    <div>
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Today
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{dayLabel.format(now)}</p>

      {showOnboarding && <OnboardingChecklist steps={onboardingSteps} />}

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/app/calls" className={`${card} hover:border-zinc-400 dark:hover:border-zinc-600`}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Calls answered today</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {callsToday}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{callsWeek} this week</p>
        </Link>
        <Link href="/app/calendar" className={`${card} hover:border-zinc-400 dark:hover:border-zinc-600`}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Next appointment</p>
          <p className="mt-1 text-lg font-semibold leading-7 text-zinc-900 dark:text-zinc-50">
            {nextAppts[0]
              ? `${dayLabel.format(nextAppts[0].startsAt)}, ${formatTimeOnly(nextAppts[0].startsAt, tz)}`
              : "Nothing booked"}
          </p>
          <p className="mt-1 line-clamp-1 text-xs text-zinc-400 dark:text-zinc-500">
            {nextAppts[0]?.title ?? "New bookings land here automatically"}
          </p>
        </Link>
        <div className={card}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">AI minutes this month</p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {minutesUsed}
            {cap && (
              <span className="text-base font-normal text-zinc-400 dark:text-zinc-500"> / {cap}</span>
            )}
          </p>
          {pct != null && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full ${pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Upcoming appointments */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Upcoming appointments
            </h2>
            <Link href="/app/calendar" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
              Calendar →
            </Link>
          </div>
          {nextAppts.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              Nothing booked yet — when your receptionist books a job it shows
              up here within seconds.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm dark:divide-zinc-900 dark:border-zinc-800 dark:bg-zinc-950">
              {nextAppts.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/app/calendar/${a.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="text-zinc-800 dark:text-zinc-200">
                      <span className="font-medium">
                        {dayLabel.format(a.startsAt)}, {formatTimeOnly(a.startsAt, tz)}
                      </span>{" "}
                      — {a.title}
                    </span>
                    {a.status === "PENDING" && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        NEEDS CONFIRM
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Newest leads */}
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Newest leads
            </h2>
            <Link href="/app/leads" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
              All leads →
            </Link>
          </div>
          {newestLeads.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No leads yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm dark:divide-zinc-900 dark:border-zinc-800 dark:bg-zinc-950">
              {newestLeads.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="min-w-0 text-zinc-800 dark:text-zinc-200">
                    <span className="font-medium">{l.name ?? l.phone}</span>
                    {l.jobType && (
                      <span className="text-zinc-500 dark:text-zinc-400"> — {l.jobType}</span>
                    )}
                    <span className="block text-xs text-zinc-400 dark:text-zinc-500">
                      {formatWhen(l.createdAt, tz)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {l.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

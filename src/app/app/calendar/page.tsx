import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { localDatePlus, formatTimeOnly, zonedToUtc } from "@/lib/tz";

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CANCELLED: "bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-900 dark:text-zinc-500",
  COMPLETED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  NO_SHOW: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const session = await requireSession();
  const { w } = await searchParams;
  const weekOffset = Number(w ?? 0) || 0;

  const org = await prisma.org.findUniqueOrThrow({
    where: { id: session.orgId },
  });
  const tz = org.timezone;
  const now = new Date();

  // Monday-start week in org timezone
  const today = localDatePlus(now, tz, 0);
  const mondayShift = -((today.weekday + 6) % 7) + weekOffset * 7;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = localDatePlus(now, tz, mondayShift + i);
    return {
      ...d,
      key: `${d.y}-${String(d.mo).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`,
      startUtc: zonedToUtc(d.y, d.mo, d.d, 0, tz),
      endUtc: zonedToUtc(d.y, d.mo, d.d, 1440, tz),
      isToday:
        weekOffset === 0 &&
        d.y === today.y &&
        d.mo === today.mo &&
        d.d === today.d,
    };
  });

  const [appointments, upcoming] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        orgId: session.orgId,
        startsAt: { gte: days[0].startUtc, lt: days[6].endUtc },
      },
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        orgId: session.orgId,
        startsAt: { gte: now },
        status: { in: ["CONFIRMED", "PENDING"] },
      },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
  ]);

  const dayName = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "short",
  });
  const monthDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
  const longLabel = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const weekLabel = `${monthDay.format(new Date(Date.UTC(days[0].y, days[0].mo - 1, days[0].d)))} – ${monthDay.format(new Date(Date.UTC(days[6].y, days[6].mo - 1, days[6].d)))}`;

  const canEdit = session.role === "OWNER" || session.role === "ADMIN";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Every job your receptionist books lands here.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {canEdit && (
            <>
              <Link
                href="/app/calendar/settings"
                className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Hours &amp; booking
              </Link>
              <Link
                href="/app/calendar/new"
                className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                New appointment
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link
          href={`/app/calendar?w=${weekOffset - 1}`}
          className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          ← Previous
        </Link>
        <div className="font-medium text-zinc-700 dark:text-zinc-300">
          {weekLabel}
          {weekOffset !== 0 && (
            <Link href="/app/calendar" className="ml-3 text-emerald-600 hover:underline dark:text-emerald-400">
              Today
            </Link>
          )}
        </div>
        <Link
          href={`/app/calendar?w=${weekOffset + 1}`}
          className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Next →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-7">
        {days.map((day) => {
          const dayAppts = appointments.filter(
            (a) => a.startsAt >= day.startUtc && a.startsAt < day.endUtc,
          );
          const utcDate = new Date(Date.UTC(day.y, day.mo - 1, day.d));
          return (
            <div
              key={day.key}
              className={`min-h-28 rounded-xl border p-2 ${
                day.isToday
                  ? "border-emerald-400 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/30"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {dayName.format(utcDate)}{" "}
                <span className="text-zinc-400 dark:text-zinc-500">{monthDay.format(utcDate)}</span>
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {dayAppts.map((a) => (
                  <Link
                    key={a.id}
                    href={`/app/calendar/${a.id}`}
                    className={`rounded-md px-1.5 py-1 text-xs leading-tight hover:opacity-80 ${STATUS_STYLES[a.status] ?? ""}`}
                  >
                    <span className="font-medium">
                      {formatTimeOnly(a.startsAt, tz)}
                    </span>{" "}
                    {a.customerName ?? a.title}
                    {a.status === "PENDING" && " (pending)"}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Upcoming
      </h2>
      {upcoming.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Nothing booked yet. When the receptionist books a job, it shows up
          here within seconds of the call.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white text-sm dark:divide-zinc-900 dark:border-zinc-800 dark:bg-zinc-950">
          {upcoming.map((a) => (
            <li key={a.id}>
              <Link
                href={`/app/calendar/${a.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="text-zinc-800 dark:text-zinc-200">
                  <span className="font-medium">
                    {longLabel.format(a.startsAt)}, {formatTimeOnly(a.startsAt, tz)}
                  </span>{" "}
                  — {a.title}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[a.status] ?? ""}`}
                >
                  {a.status === "PENDING" ? "NEEDS CONFIRM" : a.status}
                  {a.source === "AI" ? " · AI" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

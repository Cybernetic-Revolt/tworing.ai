import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import {
  accessTokenFromRefresh,
  googleConfigured,
  listCalendars,
} from "@/lib/google";
import { disconnectGoogle, saveCalendarSettings, setGoogleCalendar } from "../actions";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function toTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

const input =
  "rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

export default async function CalendarSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; google?: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/calendar");
  }
  const { saved, google } = await searchParams;

  const [settings, rules, gConn] = await Promise.all([
    prisma.calendarSettings.findUnique({ where: { orgId: session.orgId } }),
    prisma.availabilityRule.findMany({ where: { orgId: session.orgId } }),
    prisma.googleConnection.findUnique({ where: { orgId: session.orgId } }),
  ]);

  // Calendar picker options for a connected account (best-effort).
  let calendars: { id: string; summary: string }[] = [];
  let calendarListError = false;
  if (gConn && googleConfigured()) {
    try {
      const at = await accessTokenFromRefresh(decryptSecret(gConn.refreshToken));
      calendars = await listCalendars(at);
    } catch {
      calendarListError = true;
    }
  }

  // Defaults shown on first visit: Mon–Fri 8–5
  const hasRules = rules.length > 0;
  const byDay = new Map(rules.map((r) => [r.weekday, r]));

  return (
    <div className="max-w-2xl">
      <Link href="/app/calendar" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← Calendar
      </Link>
      <h1 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Hours &amp; booking
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        These rules are exactly what your AI receptionist offers callers —
        it never books outside them (except true emergencies, if enabled).
      </p>
      {saved && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          Saved. New bookings follow these rules immediately.
        </p>
      )}

      <form action={saveCalendarSettings} className="mt-6 flex flex-col gap-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Business hours
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {WEEKDAYS.map((name, wd) => {
              const rule = byDay.get(wd);
              const defaultOpen = hasRules ? !!rule : wd >= 1 && wd <= 5;
              return (
                <div
                  key={wd}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[8rem_5rem_1fr_1fr]"
                >
                  <span className="text-zinc-700 dark:text-zinc-300">{name}</span>
                  <label className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      name={`open-${wd}`}
                      defaultChecked={defaultOpen}
                      className="h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
                    />
                    Open
                  </label>
                  <input
                    type="time"
                    name={`start-${wd}`}
                    defaultValue={rule ? toTime(rule.startMin) : "08:00"}
                    className={`${input} min-w-0`}
                  />
                  <input
                    type="time"
                    name={`end-${wd}`}
                    defaultValue={rule ? toTime(rule.endMin) : "17:00"}
                    className={`${input} min-w-0`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Booking rules
          </h2>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-zinc-700 dark:text-zinc-300">
              Job length (min)
              <input type="number" name="slotMinutes" min={15} max={480} step={15} defaultValue={settings?.slotMinutes ?? 120} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-zinc-700 dark:text-zinc-300">
              Travel buffer (min)
              <input type="number" name="bufferMinutes" min={0} max={240} step={15} defaultValue={settings?.bufferMinutes ?? 30} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-zinc-700 dark:text-zinc-300">
              Max jobs per day
              <input type="number" name="maxPerDay" min={1} max={50} defaultValue={settings?.maxPerDay ?? 6} className={input} />
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1 text-zinc-700 dark:text-zinc-300">
              When the AI books a job
              <select name="bookingPolicy" defaultValue={settings?.bookingPolicy ?? "FIRM"} className={input}>
                <option value="FIRM">Book it firm — caller is confirmed on the spot</option>
                <option value="CONFIRM_FIRST">Hold it pending — I confirm each booking</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                name="emergencyOverride"
                defaultChecked={settings?.emergencyOverride ?? true}
                className="h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
              />
              Allow emergency bookings outside business hours
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Save
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Google Calendar
        </h2>
        {google === "connected" && (
          <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Connected. Now pick which calendar to sync with below.
          </p>
        )}
        {google === "saved" && (
          <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Calendar saved — bookings now sync both ways.
          </p>
        )}
        {(google === "error" || google === "expired" || google === "denied") && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            Connecting to Google didn&apos;t complete — try again.
          </p>
        )}

        {!googleConfigured() ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            Google sync isn&apos;t enabled on the server yet.
          </p>
        ) : !gConn ? (
          <div className="mt-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Connect a Google account and your receptionist will never book
              over anything already on your calendar — and every booking it
              makes appears there in seconds.
            </p>
            <a
              href="/api/google/oauth/start"
              className="mt-3 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Connect Google Calendar
            </a>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              Connected as <strong>{gConn.email}</strong>
              {gConn.calendarId
                ? ` — syncing with “${
                    calendars.find((c) => c.id === gConn.calendarId)?.summary ??
                    gConn.calendarId
                  }”`
                : " — no calendar selected yet"}
            </p>
            {gConn.lastError && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Last sync issue: {gConn.lastError}
              </p>
            )}
            {calendarListError ? (
              <p className="text-zinc-500 dark:text-zinc-400">
                Couldn&apos;t load your calendar list — reconnect below.
              </p>
            ) : (
              <form action={setGoogleCalendar} className="flex items-end gap-2">
                <label className="flex flex-col gap-1 text-zinc-700 dark:text-zinc-300">
                  Sync with calendar
                  <select
                    name="calendarId"
                    defaultValue={gConn.calendarId ?? ""}
                    className={input}
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.summary}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Save
                </button>
              </form>
            )}
            <div className="flex gap-4">
              <a href="/api/google/oauth/start" className="text-zinc-500 hover:underline dark:text-zinc-400">
                Reconnect
              </a>
              <form action={disconnectGoogle}>
                <button type="submit" className="text-red-600 hover:underline">
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

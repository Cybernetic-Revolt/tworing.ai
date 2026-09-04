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
import { disconnectGoogleAccount, saveCalendarSettings } from "../actions";
import { ConfirmButton } from "../confirm-button";
import { CalendarPicker } from "../calendar-picker";

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

  const [settings, rules, connections] = await Promise.all([
    prisma.calendarSettings.findUnique({ where: { orgId: session.orgId } }),
    prisma.availabilityRule.findMany({ where: { orgId: session.orgId } }),
    prisma.googleConnection.findMany({
      where: { orgId: session.orgId },
      include: { calendars: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // For each connected account, fetch the calendars it CAN sync (best-effort) so the picker
  // shows every option — including calendars shared with the account by other people — with
  // the currently-synced ones pre-ticked. One account's list failing does not blank the rest.
  const accounts = await Promise.all(
    connections.map(async (conn) => {
      let available: { id: string; summary: string }[] = [];
      let listError = false;
      if (googleConfigured()) {
        try {
          const at = await accessTokenFromRefresh(decryptSecret(conn.refreshToken));
          available = await listCalendars(at);
        } catch {
          listError = true;
        }
      }
      // Show the UNION of what Google offers and what is already synced, so an already-chosen
      // calendar can always be unticked even when the live list can't be fetched (a revoked or
      // expired token). Without this a bad token hid the whole picker, stranding the calendars
      // it had already selected with no way to remove them.
      const byId = new Map(available.map((c) => [c.id, c.summary]));
      for (const c of conn.calendars) if (!byId.has(c.googleId)) byId.set(c.googleId, c.summary ?? c.googleId);
      const options = [...byId].map(([id, summary]) => ({ id, summary }));
      return { conn, options, listError };
    }),
  );

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
        ) : accounts.length === 0 ? (
          <div className="mt-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Connect a Google account and your receptionist will never book
              over anything already on your calendar — and every booking it
              makes appears there in seconds. You can connect more than one
              account and sync several calendars.
            </p>
            <a
              href="/api/google/oauth/start"
              className="mt-3 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Connect Google Calendar
            </a>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-4 text-sm">
            <p className="text-zinc-600 dark:text-zinc-400">
              A booking is added to <strong>every</strong> calendar you tick below, and the
              receptionist treats a busy time on any of them as unavailable.
            </p>

            {accounts.map(({ conn, options, listError }) => (
              <div
                key={conn.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">{conn.email}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <a
                      href={`/api/google/oauth/start?account=${encodeURIComponent(conn.email)}`}
                      className="text-zinc-500 hover:underline dark:text-zinc-400"
                    >
                      Reconnect
                    </a>
                    {/* Disconnecting removes this whole account and stops tracking its events.
                        Confirmed client-side so a stray click can't unlink a live calendar. */}
                    <form action={disconnectGoogleAccount}>
                      <input type="hidden" name="connectionId" value={conn.id} />
                      <ConfirmButton
                        className="text-red-600 hover:underline"
                        confirm={`Disconnect ${conn.email}? Bookings will stop syncing to its calendars.`}
                      >
                        Disconnect
                      </ConfirmButton>
                    </form>
                  </div>
                </div>

                {conn.lastError && (
                  <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Last sync issue: {conn.lastError}
                  </p>
                )}

                <CalendarPicker
                  connectionId={conn.id}
                  options={options}
                  selected={conn.calendars.map((c) => c.googleId)}
                  listError={listError}
                />
              </div>
            ))}

            <a
              href="/api/google/oauth/start"
              className="inline-flex w-fit items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              + Connect another Google account
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

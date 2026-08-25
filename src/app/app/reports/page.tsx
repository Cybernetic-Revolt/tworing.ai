import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { foundMoneyReport } from "@/lib/reports";
import { setAverageJobValue } from "./actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function money(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(n);
}

function heatColor(count: number, max: number): string {
  if (count === 0) return "bg-zinc-100 dark:bg-zinc-900";
  const t = max > 0 ? count / max : 0;
  if (t > 0.66) return "bg-emerald-600";
  if (t > 0.33) return "bg-emerald-400";
  return "bg-emerald-200 dark:bg-emerald-800";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const session = await requireSession();
  const { m } = await searchParams;
  const monthOffset = Math.min(0, Number(m ?? 0) || 0); // never future
  const r = await foundMoneyReport(session.orgId, monthOffset);
  const canEdit = session.role === "OWNER" || session.role === "ADMIN";

  const heatMax = Math.max(1, ...r.heatmap.flat());
  const activeHours = Array.from({ length: 24 }, (_, h) => h).filter((h) =>
    r.heatmap.some((day) => day[h] > 0),
  );
  const hourSpan = activeHours.length
    ? { min: Math.min(...activeHours), max: Math.max(...activeHours) }
    : { min: 8, max: 18 };
  const hours = Array.from(
    { length: hourSpan.max - hourSpan.min + 1 },
    (_, i) => hourSpan.min + i,
  );

  const card =
    "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Found Money Report
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            What your receptionist caught that would have gone to voicemail —{" "}
            {r.monthLabel}.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/app/reports?m=${monthOffset - 1}`}
            className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            ← Previous
          </Link>
          {monthOffset < 0 && (
            <Link
              href={`/app/reports?m=${monthOffset + 1}`}
              className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Next →
            </Link>
          )}
        </div>
      </div>

      {/* Headline */}
      <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50/60 p-6 dark:border-emerald-800 dark:bg-emerald-950/40">
        {r.recoveredValue != null ? (
          <>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              Estimated recovered revenue
            </p>
            <p className="mt-1 text-4xl font-semibold text-emerald-800 dark:text-emerald-200">
              {money(r.recoveredValue)}
            </p>
            <p className="mt-2 text-sm text-emerald-700/80 dark:text-emerald-300/80">
              {r.aiBooked} job{r.aiBooked === 1 ? "" : "s"} booked by your AI ×{" "}
              {money(r.averageJobValue ?? 0)} average job value.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              {r.aiBooked} job{r.aiBooked === 1 ? "" : "s"} booked by your AI this month
            </p>
            <p className="mt-2 text-sm text-emerald-700/80 dark:text-emerald-300/80">
              Set your average job value to see what that&apos;s worth.
            </p>
            {canEdit && (
              <form action={setAverageJobValue} className="mt-3 flex items-center gap-2">
                <span className="text-emerald-800 dark:text-emerald-200">$</span>
                <input
                  name="averageJobValue"
                  inputMode="numeric"
                  placeholder="350"
                  className="w-28 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-emerald-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="submit"
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  Save
                </button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Stat row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <div className={card}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Calls answered</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {r.totalCalls}
          </p>
        </div>
        <div className={card}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">After-hours calls</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {r.afterHoursCalls}
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">caught outside business hours</p>
        </div>
        <div className={card}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Leads captured</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {r.leadsCaptured}
          </p>
        </div>
        <div className={card}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">AI minutes used</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {r.minutesUsed}
            {r.minutesCap && (
              <span className="text-base font-normal text-zinc-400 dark:text-zinc-500"> / {r.minutesCap}</span>
            )}
          </p>
          {r.minutesProjected != null && r.minutesCap != null && (
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              on track for ~{r.minutesProjected} this month
            </p>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          When your phone rings
        </h2>
        {r.peakDayHour && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Busiest: {DAYS[r.peakDayHour.weekday]} around{" "}
            {r.peakDayHour.hour % 12 || 12}
            {r.peakDayHour.hour < 12 ? "am" : "pm"}.
          </p>
        )}
        {r.totalCalls === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No calls this month yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  {hours.map((h) => (
                    <th key={h} className="px-1 py-1 font-normal text-zinc-400 dark:text-zinc-500">
                      {h % 12 || 12}
                      {h < 12 ? "a" : "p"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d, wd) => (
                  <tr key={d}>
                    <td className="pr-2 text-right text-zinc-500 dark:text-zinc-400">{d}</td>
                    {hours.map((h) => (
                      <td key={h} className="p-0.5">
                        <div
                          title={`${d} ${h}:00 — ${r.heatmap[wd][h]} call${r.heatmap[wd][h] === 1 ? "" : "s"}`}
                          className={`h-5 w-5 rounded ${heatColor(r.heatmap[wd][h], heatMax)}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {canEdit && r.recoveredValue != null && (
        <form action={setAverageJobValue} className="mt-8 flex items-center gap-2 text-sm">
          <span className="text-zinc-500 dark:text-zinc-400">Average job value:</span>
          <span className="text-zinc-800 dark:text-zinc-200">$</span>
          <input
            name="averageJobValue"
            inputMode="numeric"
            defaultValue={r.averageJobValue ?? ""}
            className="w-28 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Update
          </button>
        </form>
      )}
    </div>
  );
}

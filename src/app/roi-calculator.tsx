"use client";

import { useState } from "react";

const WEEKS_PER_MONTH = 4.33;

function money(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

const sliderClass =
  "w-full rounded accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:accent-emerald-400 dark:focus-visible:ring-offset-black";

export function RoiCalculator() {
  // Conservative, trades-credible defaults so the on-load figure lands as
  // believable rather than salesy.
  const [missedPerWeek, setMissedPerWeek] = useState(4);
  const [jobValue, setJobValue] = useState(500);
  const [closeRate, setCloseRate] = useState(30);

  const monthlyMissedJobs = missedPerWeek * WEEKS_PER_MONTH * (closeRate / 100);
  const monthlyLost = monthlyMissedJobs * jobValue;
  const annualLost = monthlyLost * 12;
  // How many recovered jobs cover the $179 Answer plan.
  const callsToCoverPlan =
    jobValue * (closeRate / 100) > 0
      ? Math.max(1, Math.ceil(179 / (jobValue * (closeRate / 100))))
      : 0;

  return (
    <div className="grid items-center gap-8 rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-6">
        <label className="block">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">
              Calls you miss per week
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {missedPerWeek}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            value={missedPerWeek}
            aria-label="Calls you miss per week"
            onChange={(e) => setMissedPerWeek(Number(e.target.value))}
            className={`mt-2 ${sliderClass}`}
          />
        </label>

        <label className="block">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">
              Average job value
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {money(jobValue)}
            </span>
          </div>
          <input
            type="range"
            min={100}
            max={5000}
            step={50}
            value={jobValue}
            aria-label="Average job value in dollars"
            onChange={(e) => setJobValue(Number(e.target.value))}
            className={`mt-2 ${sliderClass}`}
          />
        </label>

        <label className="block">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">
              How often a caller becomes a customer
            </span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-50">
              {closeRate}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={90}
            step={5}
            value={closeRate}
            aria-label="Percent of callers who become customers"
            onChange={(e) => setCloseRate(Number(e.target.value))}
            className={`mt-2 ${sliderClass}`}
          />
        </label>
      </div>

      <div
        aria-live="polite"
        className="rounded-xl border border-emerald-300 bg-emerald-50/60 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950/40"
      >
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          Missed-call revenue you&apos;re losing
        </p>
        <p className="mt-1 text-4xl font-semibold text-emerald-800 dark:text-emerald-200">
          {money(monthlyLost)}
          <span className="text-lg font-normal text-emerald-700/70 dark:text-emerald-300/70">
            {" "}
            / mo
          </span>
        </p>
        <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-300/80">
          about {money(annualLost)} a year
        </p>
        <p className="mt-4 border-t border-emerald-200 pt-4 text-sm text-emerald-800 dark:border-emerald-800/60 dark:text-emerald-200">
          TwoRing Answer is <strong>$179/mo</strong> — it pays for itself if it
          saves just <strong>{callsToCoverPlan}</strong> of those jobs.
        </p>
        <p className="mt-3 text-xs text-emerald-700/70 dark:text-emerald-300/70">
          An estimate from your numbers — not a guarantee.
        </p>
      </div>
    </div>
  );
}

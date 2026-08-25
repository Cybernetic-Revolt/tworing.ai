import Link from "next/link";

export type OnboardingStep = {
  label: string;
  help: string;
  href: string;
  done: boolean;
};

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

/**
 * "Get set up" card shown on the dashboard until a new customer has completed
 * the four activation steps. It renders nothing once every step is done, so it
 * disappears on its own — no dismiss state to track.
 */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <section
      aria-label="Setup checklist"
      className="mt-6 overflow-hidden rounded-xl border border-emerald-300 bg-emerald-50/60 dark:border-emerald-800/70 dark:bg-emerald-950/30"
    >
      <div className="flex flex-col gap-3 border-b border-emerald-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-900/60">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-emerald-900 dark:text-emerald-100">
            Finish setting up your receptionist
          </h2>
          <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-300/80">
            A few quick steps and you&apos;re fully live.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:shrink-0">
          <div
            className="h-1.5 w-28 overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900/70"
            role="progressbar"
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-label={`${done} of ${steps.length} setup steps complete`}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width] motion-reduce:transition-none dark:bg-emerald-400"
              style={{ width: `${(done / steps.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-emerald-800 tabular-nums dark:text-emerald-200">
            {done} / {steps.length}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-emerald-200/70 dark:divide-emerald-900/50">
        {steps.map((s) => (
          <li key={s.label}>
            {s.done ? (
              <div className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white dark:bg-emerald-400 dark:text-emerald-950">
                  <CheckIcon />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-900/70 line-through dark:text-emerald-100/60">
                    {s.label}
                  </p>
                </div>
              </div>
            ) : (
              <Link
                href={s.href}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-emerald-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 dark:hover:bg-emerald-900/30"
              >
                <span
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-emerald-400 dark:border-emerald-600"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                    {s.help}
                  </p>
                </div>
                <span className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden>
                  →
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

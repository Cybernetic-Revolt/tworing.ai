/* Shared TwoRing brand marks — the single source of truth for the logo.
   Used by the landing page, portal, admin, login, demo, and legal shells.
   Keep visually in sync with src/app/icon.svg and src/app/opengraph-image.tsx. */

export function RingMark({
  className = "h-7 w-7",
  animate = false,
}: {
  className?: string;
  /** Play the "two rings" emanate animation on mount (the header brand moment). */
  animate?: boolean;
}) {
  return (
    <svg
      className={animate ? `${className} ring-anim` : className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      {/* the dot = the phone; always present. The two arcs = the rings. */}
      <circle cx="12" cy="16" r="5" className="fill-emerald-500" />
      <path
        d="M21 9.5a9 9 0 0 1 0 13"
        className={animate ? "stroke-emerald-500 ring-arc ring-arc-1" : "stroke-emerald-500"}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M25 6a13.5 13.5 0 0 1 0 20"
        className={animate ? "stroke-emerald-500/55 ring-arc ring-arc-2" : "stroke-emerald-500/55"}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({
  className = "text-lg font-semibold tracking-tight",
}: {
  className?: string;
}) {
  return (
    <span className={className}>
      Two<span className="text-emerald-600 dark:text-emerald-400">Ring</span>
    </span>
  );
}

/* The full lockup: ring mark + wordmark. Defaults match the landing-page header.
   Pass markClassName / wordmarkClassName to scale it for tighter chrome. */
export function Logo({
  className = "flex items-center gap-2",
  markClassName = "h-7 w-7",
  wordmarkClassName = "text-lg font-semibold tracking-tight",
  animate = false,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  animate?: boolean;
}) {
  return (
    <span className={className}>
      <RingMark className={markClassName} animate={animate} />
      <Wordmark className={wordmarkClassName} />
    </span>
  );
}

// Minimal IANA timezone math (no deps): convert org-local wall time to UTC
// instants and back. Minute precision; DST-safe via double offset lookup.

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export type WallTime = {
  y: number;
  mo: number; // 1–12
  d: number;
  h: number;
  mi: number;
  weekday: number; // 0 = Sunday … 6 = Saturday
};

export function wallTime(utc: Date, tz: string): WallTime {
  const parts = Object.fromEntries(
    fmt(tz)
      .formatToParts(utc)
      .map((p) => [p.type, p.value]),
  );
  const y = Number(parts.year);
  const mo = Number(parts.month);
  const d = Number(parts.day);
  const h = Number(parts.hour) % 24; // "24" at midnight in some ICU versions
  const mi = Number(parts.minute);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return { y, mo, d, h, mi, weekday };
}

function offsetMs(tz: string, utc: Date): number {
  const wt = wallTime(utc, tz);
  const asUtc = Date.UTC(wt.y, wt.mo - 1, wt.d, wt.h, wt.mi);
  const utcMinute = Math.floor(utc.getTime() / 60000) * 60000;
  return asUtc - utcMinute;
}

// UTC instant for a wall-clock time (minutes from midnight) on y-mo-d in tz.
export function zonedToUtc(
  y: number,
  mo: number,
  d: number,
  minutesFromMidnight: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, mo - 1, d, 0, minutesFromMidnight);
  const utc1 = guess - offsetMs(tz, new Date(guess));
  return new Date(guess - offsetMs(tz, new Date(utc1)));
}

// The wall-clock calendar date in tz at `now`, shifted by `days`.
export function localDatePlus(
  now: Date,
  tz: string,
  days: number,
): { y: number; mo: number; d: number; weekday: number } {
  const wt = wallTime(now, tz);
  const shifted = new Date(Date.UTC(wt.y, wt.mo - 1, wt.d + days));
  return {
    y: shifted.getUTCFullYear(),
    mo: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

export function formatSlotLabel(utc: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(utc);
}

export function formatTimeOnly(utc: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(utc);
}

// Availability engine: weekly rules × slot length × buffer × max/day ×
// existing appointments × Google busy blocks (when the org is connected).
import { prisma } from "@/lib/db";
import { googleBusy } from "@/lib/google-sync";
import { localDatePlus, zonedToUtc } from "@/lib/tz";

export type Slot = { start: Date; end: Date };

export type EffectiveCalendarConfig = {
  tz: string;
  slotMinutes: number;
  bufferMinutes: number;
  maxPerDay: number;
  emergencyOverride: boolean;
  bookingPolicy: "FIRM" | "CONFIRM_FIRST";
  rules: { weekday: number; startMin: number; endMin: number }[];
};

const MIN_LEAD_MINUTES = 60; // never offer a slot starting within the hour

export async function getCalendarConfig(
  orgId: string,
): Promise<EffectiveCalendarConfig> {
  const [org, settings, rules] = await Promise.all([
    prisma.org.findUniqueOrThrow({ where: { id: orgId } }),
    prisma.calendarSettings.findUnique({ where: { orgId } }),
    prisma.availabilityRule.findMany({
      where: { orgId },
      orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
    }),
  ]);
  return {
    tz: org.timezone,
    slotMinutes: settings?.slotMinutes ?? 120,
    bufferMinutes: settings?.bufferMinutes ?? 30,
    maxPerDay: settings?.maxPerDay ?? 6,
    emergencyOverride: settings?.emergencyOverride ?? true,
    bookingPolicy: settings?.bookingPolicy ?? "FIRM",
    rules,
  };
}

type Busy = { startsAt: Date; endsAt: Date };

async function busyAppointments(
  orgId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Busy[]> {
  return prisma.appointment.findMany({
    where: {
      orgId,
      status: { in: ["CONFIRMED", "PENDING"] },
      startsAt: { lt: rangeEnd },
      endsAt: { gt: new Date(rangeStart.getTime() - 24 * 3600_000) },
    },
    select: { startsAt: true, endsAt: true },
  });
}

function conflicts(busy: Busy[], start: Date, end: Date, bufferMin: number): boolean {
  const pad = bufferMin * 60_000;
  return busy.some(
    (a) =>
      a.startsAt.getTime() - pad < end.getTime() &&
      a.endsAt.getTime() + pad > start.getTime(),
  );
}

export async function openSlots(
  orgId: string,
  opts?: { days?: number; max?: number; from?: Date; durationMinutes?: number },
): Promise<Slot[]> {
  const cfg = await getCalendarConfig(orgId);
  if (cfg.rules.length === 0) return [];

  const now = new Date();
  const from = opts?.from && opts.from > now ? opts.from : now;
  const days = opts?.days ?? 7;
  const max = opts?.max ?? 20;
  const dur = opts?.durationMinutes ?? cfg.slotMinutes;

  const rangeEnd = new Date(from.getTime() + (days + 1) * 86400_000);
  const [appts, gBusy] = await Promise.all([
    busyAppointments(orgId, from, rangeEnd),
    googleBusy(orgId, from, rangeEnd),
  ]);
  // Google blocks join conflict checks (with buffer) but don't count toward
  // maxPerDay — they're the owner's other commitments, not jobs.
  const busy = appts.concat(
    gBusy.map((b) => ({ startsAt: b.start, endsAt: b.end })),
  );

  const out: Slot[] = [];
  for (let i = 0; i <= days && out.length < max; i++) {
    const day = localDatePlus(from, cfg.tz, i);
    const dayRules = cfg.rules.filter((r) => r.weekday === day.weekday);
    if (dayRules.length === 0) continue;

    const dayStart = zonedToUtc(day.y, day.mo, day.d, 0, cfg.tz);
    const dayEnd = zonedToUtc(day.y, day.mo, day.d, 1440, cfg.tz);
    const dayCount = appts.filter(
      (a) => a.startsAt >= dayStart && a.startsAt < dayEnd,
    ).length;
    if (dayCount >= cfg.maxPerDay) continue;

    for (const r of dayRules) {
      for (
        let m = r.startMin;
        m + dur <= r.endMin && out.length < max;
        m += cfg.slotMinutes
      ) {
        const start = zonedToUtc(day.y, day.mo, day.d, m, cfg.tz);
        if (start.getTime() < now.getTime() + MIN_LEAD_MINUTES * 60_000) continue;
        const end = new Date(start.getTime() + dur * 60_000);
        if (!conflicts(busy, start, end, cfg.bufferMinutes)) {
          out.push({ start, end });
        }
      }
    }
  }
  return out;
}

// Re-validate a specific slot at booking time. Emergencies (when the org
// allows the override) skip business-hours and max/day checks but never
// double-book over an existing appointment.
export async function validateSlot(
  orgId: string,
  start: Date,
  end: Date,
  opts?: { emergency?: boolean },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const cfg = await getCalendarConfig(orgId);
  const now = new Date();
  if (start.getTime() < now.getTime()) {
    return { ok: false, reason: "that time is in the past" };
  }

  const [appts, gBusy] = await Promise.all([
    busyAppointments(orgId, start, end),
    googleBusy(orgId, start, end),
  ]);
  const busy = appts.concat(
    gBusy.map((b) => ({ startsAt: b.start, endsAt: b.end })),
  );
  if (conflicts(busy, start, end, cfg.bufferMinutes)) {
    return { ok: false, reason: "that time is no longer available" };
  }

  const emergency = (opts?.emergency ?? false) && cfg.emergencyOverride;
  if (!emergency) {
    const day = (() => {
      // derive the wall date of `start` in org tz
      const probe = localDatePlus(start, cfg.tz, 0);
      return probe;
    })();
    const startOfDay = zonedToUtc(day.y, day.mo, day.d, 0, cfg.tz);
    const minutes = Math.round((start.getTime() - startOfDay.getTime()) / 60_000);
    const endMinutes = Math.round((end.getTime() - startOfDay.getTime()) / 60_000);
    const inWindow = cfg.rules.some(
      (r) =>
        r.weekday === day.weekday && minutes >= r.startMin && endMinutes <= r.endMin,
    );
    if (!inWindow) {
      return { ok: false, reason: "that time is outside business hours" };
    }
    const dayEnd = zonedToUtc(day.y, day.mo, day.d, 1440, cfg.tz);
    const dayCount = appts.filter(
      (a) => a.startsAt >= startOfDay && a.startsAt < dayEnd,
    ).length;
    if (dayCount >= cfg.maxPerDay) {
      return { ok: false, reason: "that day is fully booked" };
    }
  }
  return { ok: true };
}

// The Found Money Report (spec §4.9) — the product's identity made visible:
// what the AI recovered that a human-on-business-hours would have missed.
import { prisma } from "@/lib/db";
import { getCalendarConfig } from "@/lib/availability";
import { wallTime, zonedToUtc } from "@/lib/tz";

const TIER_MINUTES: Record<string, number | null> = {
  ANSWER: 400,
  OFFICE: 800,
  OPERATIONS: 1200,
  CUSTOM: null,
};

export type FoundMoney = {
  tz: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  averageJobValue: number | null;
  totalCalls: number;
  afterHoursCalls: number;
  leadsCaptured: number;
  aiBooked: number;
  recoveredValue: number | null; // aiBooked × averageJobValue
  minutesUsed: number;
  minutesCap: number | null;
  minutesProjected: number | null;
  heatmap: number[][]; // [weekday 0-6][hour 0-23] = call count
  peakDayHour: { weekday: number; hour: number; count: number } | null;
};

export async function foundMoneyReport(
  orgId: string,
  monthOffset: number,
): Promise<FoundMoney> {
  const cfg = await getCalendarConfig(orgId);
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });
  const tz = cfg.tz;
  const now = new Date();
  const nowWt = wallTime(now, tz);

  // Target month (org tz), shifted by monthOffset.
  const targetMonthIndex = nowWt.mo - 1 + monthOffset;
  const y = nowWt.y + Math.floor(targetMonthIndex / 12);
  const mo = ((targetMonthIndex % 12) + 12) % 12; // 0-11
  const monthStart = zonedToUtc(y, mo + 1, 1, 0, tz);
  const monthEnd = zonedToUtc(mo === 11 ? y + 1 : y, ((mo + 1) % 12) + 1, 1, 0, tz);
  const isCurrentMonth = monthOffset === 0;

  const ruleByDay = new Map<number, { startMin: number; endMin: number }[]>();
  for (const r of cfg.rules) {
    const arr = ruleByDay.get(r.weekday) ?? [];
    arr.push({ startMin: r.startMin, endMin: r.endMin });
    ruleByDay.set(r.weekday, arr);
  }

  const [calls, leadsCaptured, aiBooked] = await Promise.all([
    prisma.call.findMany({
      where: { orgId, startedAt: { gte: monthStart, lt: monthEnd } },
      select: { startedAt: true, durationSec: true },
    }),
    prisma.lead.count({
      where: { orgId, createdAt: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.appointment.count({
      where: {
        orgId,
        source: "AI",
        status: { in: ["CONFIRMED", "PENDING", "COMPLETED"] },
        createdAt: { gte: monthStart, lt: monthEnd },
      },
    }),
  ]);

  const heatmap: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );
  let afterHoursCalls = 0;
  let secondsUsed = 0;
  let peak = { weekday: 0, hour: 0, count: 0 };

  for (const c of calls) {
    const wt = wallTime(c.startedAt, tz);
    heatmap[wt.weekday][wt.h] += 1;
    if (heatmap[wt.weekday][wt.h] > peak.count) {
      peak = { weekday: wt.weekday, hour: wt.h, count: heatmap[wt.weekday][wt.h] };
    }
    secondsUsed += c.durationSec ?? 0;

    const minutes = wt.h * 60 + wt.mi;
    const windows = ruleByDay.get(wt.weekday) ?? [];
    const inHours = windows.some((w) => minutes >= w.startMin && minutes < w.endMin);
    if (!inHours) afterHoursCalls += 1;
  }

  const minutesUsed = Math.round(secondsUsed / 60);
  const cap = TIER_MINUTES[org.tier] ?? null;

  // Projection: scale current usage to the full month (current month only).
  let minutesProjected: number | null = null;
  if (isCurrentMonth) {
    const daysInMonth = new Date(Date.UTC(mo === 11 ? y + 1 : y, (mo + 1) % 12, 0)).getUTCDate();
    const dayOfMonth = nowWt.d;
    minutesProjected =
      dayOfMonth > 0 ? Math.round((minutesUsed / dayOfMonth) * daysInMonth) : minutesUsed;
  }

  const avg = org.averageJobValue ?? null;

  return {
    tz,
    monthLabel: new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    }).format(new Date(Date.UTC(y, mo, 1))),
    isCurrentMonth,
    averageJobValue: avg,
    totalCalls: calls.length,
    afterHoursCalls,
    leadsCaptured,
    aiBooked,
    recoveredValue: avg != null ? aiBooked * avg : null,
    minutesUsed,
    minutesCap: cap,
    minutesProjected,
    heatmap,
    peakDayHour: peak.count > 0 ? peak : null,
  };
}

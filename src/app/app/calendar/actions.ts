"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pushAppointment } from "@/lib/google-sync";
import { maybeSendReviewRequest } from "@/lib/review";
import { zonedToUtc } from "@/lib/tz";

// MEMBER (incl. demo sessions) is read-only; appointment and settings
// mutations need OWNER or ADMIN.
async function requireEditor() {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/calendar");
  }
  return session;
}

function s(v: FormDataEntryValue | null): string | undefined {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? undefined : t;
}

async function parseStartEnd(
  orgId: string,
  form: FormData,
): Promise<{ startsAt: Date; endsAt: Date } | null> {
  const date = s(form.get("date")); // YYYY-MM-DD
  const time = s(form.get("time")); // HH:MM
  const duration = Number(s(form.get("duration")) ?? 120);
  if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const org = await prisma.org.findUniqueOrThrow({ where: { id: orgId } });
  const [y, mo, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const startsAt = zonedToUtc(y, mo, d, hh * 60 + mm, org.timezone);
  const endsAt = new Date(
    startsAt.getTime() + Math.min(Math.max(duration, 15), 600) * 60_000,
  );
  return { startsAt, endsAt };
}

export async function createAppointment(form: FormData): Promise<void> {
  const session = await requireEditor();
  const when = await parseStartEnd(session.orgId, form);
  const customerName = s(form.get("customerName"));
  if (!when || !customerName) redirect("/app/calendar/new?error=1");

  const jobType = s(form.get("jobType"));
  const appt = await prisma.appointment.create({
    data: {
      orgId: session.orgId,
      title: `${jobType ?? "Service call"} — ${customerName}`,
      customerName,
      customerPhone: s(form.get("customerPhone")),
      address: s(form.get("address")),
      jobType,
      notes: s(form.get("notes")),
      startsAt: when.startsAt,
      endsAt: when.endsAt,
      source: "PORTAL",
      status: "CONFIRMED",
    },
  });
  await pushAppointment(appt.id, "create");
  revalidatePath("/app/calendar");
  redirect("/app/calendar");
}

export async function updateAppointment(form: FormData): Promise<void> {
  const session = await requireEditor();
  const id = s(form.get("id"));
  if (!id) redirect("/app/calendar");

  const appt = await prisma.appointment.findFirst({
    where: { id, orgId: session.orgId },
  });
  if (!appt) redirect("/app/calendar");

  const when = await parseStartEnd(session.orgId, form);
  const customerName = s(form.get("customerName"));
  if (!when || !customerName) redirect(`/app/calendar/${id}?error=1`);

  const jobType = s(form.get("jobType"));
  await prisma.appointment.update({
    where: { id: appt.id },
    data: {
      title: `${jobType ?? "Service call"} — ${customerName}`,
      customerName,
      customerPhone: s(form.get("customerPhone")),
      address: s(form.get("address")),
      jobType,
      notes: s(form.get("notes")),
      startsAt: when.startsAt,
      endsAt: when.endsAt,
    },
  });
  await pushAppointment(appt.id, "update");
  revalidatePath("/app/calendar");
  redirect(`/app/calendar/${id}`);
}

export async function setAppointmentStatus(form: FormData): Promise<void> {
  const session = await requireEditor();
  const id = s(form.get("id"));
  const status = s(form.get("status"));
  const allowed = ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;
  if (!id || !allowed.includes(status as (typeof allowed)[number])) {
    redirect("/app/calendar");
  }
  await prisma.appointment.updateMany({
    where: { id, orgId: session.orgId },
    data: { status: status as (typeof allowed)[number] },
  });
  await pushAppointment(id!, status === "CANCELLED" ? "cancel" : "update");
  if (status === "COMPLETED") {
    await maybeSendReviewRequest(id!).catch(() => {});
  }
  revalidatePath("/app/calendar");
  redirect(`/app/calendar/${id}`);
}

/**
 * Confirm a Google connection belongs to the caller's org before touching it.
 *
 * The connection/calendar ids arrive from a form, so without this an OWNER of one org could
 * disconnect or re-scope another org's calendar by posting its id. Every management action
 * below resolves ownership through this first.
 */
async function ownedConnection(connectionId: string, orgId: string) {
  return prisma.googleConnection.findFirst({ where: { id: connectionId, orgId } });
}

/**
 * Set the exact set of calendars a connection syncs, from the multi-select on the settings
 * page. Adds the newly-ticked ones and removes the unticked ones in a transaction, so the
 * stored set always matches what the operator saw when they hit Save. Removing a calendar
 * cascades its `AppointmentGoogleEvent` rows; the events already on that Google calendar are
 * left in place (we stop tracking them rather than deleting someone's calendar history).
 */
export async function setGoogleCalendars(form: FormData): Promise<void> {
  const session = await requireEditor();
  const connectionId = s(form.get("connectionId"));
  if (!connectionId) redirect("/app/calendar/settings");
  const conn = await ownedConnection(connectionId!, session.orgId);
  if (!conn) redirect("/app/calendar/settings");

  // Each chosen calendar posts as "cal:<googleId>" plus a hidden "summary:<googleId>" so we
  // can store a display name without a second round-trip to Google.
  const chosen = new Map<string, string | null>();
  for (const [k, v] of form.entries()) {
    if (k.startsWith("cal:") && v === "on") {
      const googleId = k.slice(4);
      chosen.set(googleId, s(form.get(`summary:${googleId}`)) ?? null);
    }
  }

  const existing = await prisma.googleCalendar.findMany({ where: { connectionId: conn!.id } });
  const existingIds = new Set(existing.map((c) => c.googleId));
  const toRemove = existing.filter((c) => !chosen.has(c.googleId)).map((c) => c.id);

  await prisma.$transaction([
    ...(toRemove.length
      ? [prisma.googleCalendar.deleteMany({ where: { id: { in: toRemove } } })]
      : []),
    ...[...chosen.entries()].map(([googleId, summary]) =>
      existingIds.has(googleId)
        ? prisma.googleCalendar.updateMany({
            where: { connectionId: conn!.id, googleId },
            data: { summary },
          })
        : prisma.googleCalendar.create({
            data: { connectionId: conn!.id, googleId, summary },
          }),
    ),
    prisma.googleConnection.update({
      where: { id: conn!.id },
      data: { syncEnabled: true, lastError: null },
    }),
  ]);

  revalidatePath("/app/calendar/settings");
  redirect("/app/calendar/settings?google=saved");
}

/** Disconnect ONE Google account (not every account on the org). */
export async function disconnectGoogleAccount(form: FormData): Promise<void> {
  const session = await requireEditor();
  const connectionId = s(form.get("connectionId"));
  if (!connectionId) redirect("/app/calendar/settings");
  // deleteMany with the org in the WHERE is the ownership check and the delete in one — a
  // foreign id simply matches nothing. Cascades its calendars and their appointment-event rows.
  await prisma.googleConnection.deleteMany({
    where: { id: connectionId!, orgId: session.orgId },
  });
  revalidatePath("/app/calendar/settings");
  redirect("/app/calendar/settings?google=disconnected");
}

export async function saveCalendarSettings(form: FormData): Promise<void> {
  const session = await requireEditor();

  const slotMinutes = Math.min(Math.max(Number(s(form.get("slotMinutes")) ?? 120), 15), 480);
  const bufferMinutes = Math.min(Math.max(Number(s(form.get("bufferMinutes")) ?? 30), 0), 240);
  const maxPerDay = Math.min(Math.max(Number(s(form.get("maxPerDay")) ?? 6), 1), 50);
  const bookingPolicy =
    s(form.get("bookingPolicy")) === "CONFIRM_FIRST" ? "CONFIRM_FIRST" : "FIRM";
  const emergencyOverride = form.get("emergencyOverride") === "on";

  const rules: { weekday: number; startMin: number; endMin: number }[] = [];
  for (let wd = 0; wd < 7; wd++) {
    if (form.get(`open-${wd}`) !== "on") continue;
    const start = s(form.get(`start-${wd}`));
    const end = s(form.get(`end-${wd}`));
    if (!start || !end) continue;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (endMin > startMin) rules.push({ weekday: wd, startMin, endMin });
  }

  await prisma.$transaction([
    prisma.calendarSettings.upsert({
      where: { orgId: session.orgId },
      create: {
        orgId: session.orgId,
        slotMinutes,
        bufferMinutes,
        maxPerDay,
        bookingPolicy,
        emergencyOverride,
      },
      update: { slotMinutes, bufferMinutes, maxPerDay, bookingPolicy, emergencyOverride },
    }),
    prisma.availabilityRule.deleteMany({ where: { orgId: session.orgId } }),
    prisma.availabilityRule.createMany({
      data: rules.map((r) => ({ ...r, orgId: session.orgId })),
    }),
  ]);
  revalidatePath("/app/calendar");
  redirect("/app/calendar/settings?saved=1");
}

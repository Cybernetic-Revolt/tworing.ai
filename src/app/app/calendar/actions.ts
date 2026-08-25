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

export async function setGoogleCalendar(form: FormData): Promise<void> {
  const session = await requireEditor();
  const calendarId = s(form.get("calendarId"));
  if (!calendarId) redirect("/app/calendar/settings");
  await prisma.googleConnection.updateMany({
    where: { orgId: session.orgId },
    data: { calendarId, syncEnabled: true, lastError: null },
  });
  revalidatePath("/app/calendar/settings");
  redirect("/app/calendar/settings?google=saved");
}

export async function disconnectGoogle(): Promise<void> {
  const session = await requireEditor();
  await prisma.googleConnection.deleteMany({
    where: { orgId: session.orgId },
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

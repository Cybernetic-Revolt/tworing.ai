// Org-level Google Calendar sync orchestration.
// - Outbound: appointments push to the connected calendar (create/update/cancel).
// - Inbound: busy blocks feed the availability engine via googleBusy().
// Sync failures never block a booking — they record lastError for the
// settings page / Engineer console and the booking proceeds.
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import {
  accessTokenFromRefresh,
  deleteEvent,
  freeBusy,
  googleConfigured,
  insertEvent,
  patchEvent,
} from "@/lib/google";

type Appt = {
  id: string;
  orgId: string;
  title: string;
  customerName: string | null;
  customerPhone: string | null;
  address: string | null;
  jobType: string | null;
  notes: string | null;
  startsAt: Date;
  endsAt: Date;
  googleEventId: string | null;
};

async function activeConnection(orgId: string) {
  if (!googleConfigured()) return null;
  const conn = await prisma.googleConnection.findUnique({ where: { orgId } });
  if (!conn || !conn.syncEnabled || !conn.calendarId) return null;
  return conn;
}

async function recordError(orgId: string, err: unknown): Promise<void> {
  const msg = String(err).slice(0, 500);
  console.error("google sync error", orgId, msg);
  await prisma.googleConnection
    .update({ where: { orgId }, data: { lastError: msg } })
    .catch(() => {});
}

function eventBody(appt: Appt, tz: string) {
  const lines = [
    appt.customerName ? `Customer: ${appt.customerName}` : null,
    appt.customerPhone ? `Phone: ${appt.customerPhone}` : null,
    appt.address ? `Address: ${appt.address}` : null,
    appt.jobType ? `Job: ${appt.jobType}` : null,
    appt.notes ? `Notes: ${appt.notes}` : null,
    "",
    "Booked by TwoRing",
  ].filter((l): l is string => l !== null);
  return {
    summary: appt.title,
    description: lines.join("\n"),
    start: { dateTime: appt.startsAt.toISOString(), timeZone: tz },
    end: { dateTime: appt.endsAt.toISOString(), timeZone: tz },
  };
}

export async function pushAppointment(
  apptId: string,
  action: "create" | "update" | "cancel",
): Promise<void> {
  const appt = await prisma.appointment.findUnique({
    where: { id: apptId },
    include: { org: { select: { timezone: true } } },
  });
  if (!appt) return;
  const conn = await activeConnection(appt.orgId);
  if (!conn) return;

  try {
    const at = await accessTokenFromRefresh(decryptSecret(conn.refreshToken));
    if (action === "cancel") {
      if (appt.googleEventId) {
        await deleteEvent(at, conn.calendarId!, appt.googleEventId);
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { googleEventId: null },
        });
      }
    } else if (appt.googleEventId) {
      await patchEvent(
        at,
        conn.calendarId!,
        appt.googleEventId,
        eventBody(appt, appt.org.timezone),
      );
    } else {
      const eventId = await insertEvent(
        at,
        conn.calendarId!,
        eventBody(appt, appt.org.timezone),
      );
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { googleEventId: eventId },
      });
    }
    await prisma.googleConnection.update({
      where: { orgId: appt.orgId },
      data: { lastSyncAt: new Date(), lastError: null },
    });
  } catch (err) {
    await recordError(appt.orgId, err);
  }
}

// Busy intervals from the org's Google calendar for the availability engine.
// Returns [] when not connected or on error (booking proceeds on our own data).
export async function googleBusy(
  orgId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ start: Date; end: Date }[]> {
  const conn = await activeConnection(orgId);
  if (!conn) return [];
  try {
    const at = await accessTokenFromRefresh(decryptSecret(conn.refreshToken));
    const busy = await freeBusy(at, conn.calendarId!, rangeStart, rangeEnd);
    await prisma.googleConnection.update({
      where: { orgId },
      data: { lastSyncAt: new Date(), lastError: null },
    });
    return busy;
  } catch (err) {
    await recordError(orgId, err);
    return [];
  }
}

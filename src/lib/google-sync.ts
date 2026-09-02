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

/**
 * The connection to sync through, or null having recorded why.
 *
 * This used to return null silently for four different reasons, and "not configured",
 * "sync switched off", "no calendar chosen" and "nothing to sync" were indistinguishable
 * from the outside. bilco's org sat in exactly that state: OAuth connected, refresh token
 * valid, availability configured — and no calendar ever selected, so every booking saved to
 * the database, told the caller it was booked, and never reached Google. `lastError` read
 * "(none)" throughout, because nothing had failed. Nothing had run.
 *
 * The reason is now written to `lastError`, which the settings page and the Engineer console
 * already display. A configuration that cannot sync should look different from one with
 * nothing to do.
 */
async function activeConnection(orgId: string) {
  if (!googleConfigured()) {
    // Server-wide, not org-specific: no client id/secret in the environment. Not recorded
    // against the org, because it is not the org's problem and would appear for every one.
    console.warn("google sync skipped: GOOGLE_CLIENT_ID/SECRET not configured");
    return null;
  }
  const conn = await prisma.googleConnection.findUnique({ where: { orgId } });
  if (!conn) return null; // Never connected. Nothing to report against.

  const reason = !conn.syncEnabled
    ? "Sync is switched off for this connection."
    : !conn.calendarId
      ? "Connected, but no calendar has been chosen — bookings are NOT reaching Google. " +
        "Pick one under Hours & booking."
      : null;

  if (reason) {
    // Only write when it changes, so a silent-but-broken connection does not rewrite the
    // same row on every booking.
    if (conn.lastError !== reason) {
      await prisma.googleConnection
        .update({ where: { orgId }, data: { lastError: reason } })
        .catch(() => {});
    }
    console.warn("google sync skipped for %s: %s", orgId, reason);
    return null;
  }

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

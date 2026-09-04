// Org-level Google Calendar sync orchestration — now fan-out across many calendars.
//
// An org may connect several Google accounts, each syncing several calendars. A booking is
// written to EVERY selected calendar (one Google event per calendar, tracked in
// AppointmentGoogleEvent) and availability is the UNION of every calendar's busy times, so
// the receptionist never books over a conflict on any of them.
//
// The two public entry points keep their old signatures — `pushAppointment(apptId, action)`
// and `googleBusy(orgId, start, end)` — so every caller (availability, the vapi tools, the
// portal calendar actions) is unchanged; only the fan-out behind them is new.
//
// Failures are isolated and never block a booking: one calendar (or one whole account) that
// errors records its reason against its own connection and the others still sync. A booking
// that the caller was told is confirmed must reach as many calendars as it can, not none.
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
};

/**
 * The connections to sync through, each with the calendars it targets — or an empty list
 * having recorded, per connection, why it is idle.
 *
 * The per-connection reason (`lastError`) is what the settings page shows. "Not configured",
 * "sync off" and "no calendar chosen" must look different from "nothing to do", so a
 * connection that cannot sync says why rather than sitting silently — the failure that let
 * bilco's bookings never reach Google while `lastError` read "(none)".
 */
async function syncTargets(orgId: string) {
  if (!googleConfigured()) {
    // Server-wide, not any one org's problem — do not stamp it on every connection.
    console.warn("google sync skipped: GOOGLE_CLIENT_ID/SECRET not configured");
    return [];
  }
  const connections = await prisma.googleConnection.findMany({
    where: { orgId },
    include: { calendars: true },
  });

  const targets: { connection: (typeof connections)[number] }[] = [];
  for (const connection of connections) {
    const reason = !connection.syncEnabled
      ? "Sync is switched off for this connection."
      : connection.calendars.length === 0
        ? "Connected, but no calendar has been chosen — bookings are NOT reaching this " +
          "account. Pick at least one calendar under Hours & booking."
        : null;

    if (reason) {
      // Write only on change so a persistently-idle connection is not rewritten per booking.
      if (connection.lastError !== reason) {
        await prisma.googleConnection
          .update({ where: { id: connection.id }, data: { lastError: reason } })
          .catch(() => {});
      }
      continue;
    }
    targets.push({ connection });
  }
  return targets;
}

async function recordError(connectionId: string, err: unknown): Promise<void> {
  const msg = String(err).slice(0, 500);
  console.error("google sync error", connectionId, msg);
  await prisma.googleConnection
    .update({ where: { id: connectionId }, data: { lastError: msg } })
    .catch(() => {});
}

async function markSynced(connectionId: string): Promise<void> {
  await prisma.googleConnection
    .update({ where: { id: connectionId }, data: { lastSyncAt: new Date(), lastError: null } })
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

/** One calendar's worth of work for an appointment, decided without any I/O. */
export type CalendarOp =
  | { kind: "insert"; calendarRowId: string; googleId: string }
  | { kind: "patch"; calendarRowId: string; googleId: string; eventId: string }
  | { kind: "delete"; calendarRowId: string; googleId: string; eventId: string }
  | { kind: "noop"; calendarRowId: string; googleId: string };

/**
 * What to do on each calendar, given the events this appointment already has and the action.
 *
 * Pure and total so it can be tested without touching Google or the database. The subtle case
 * it exists to get right: after a new calendar is added to an account, editing an OLD booking
 * must PATCH the calendars it already lives on and INSERT onto the new one — a single
 * "update vs create" flag per appointment (the old `googleEventId`) could not express that.
 * Cancelling only deletes where an event actually exists; a calendar with no event is a noop,
 * never a spurious delete.
 */
export function planOps(
  existing: { calendarId: string; eventId: string }[],
  calendars: { id: string; googleId: string }[],
  action: "create" | "update" | "cancel",
): CalendarOp[] {
  const byCalendar = new Map(existing.map((e) => [e.calendarId, e.eventId]));
  return calendars.map((cal) => {
    const eventId = byCalendar.get(cal.id);
    if (action === "cancel") {
      return eventId
        ? { kind: "delete", calendarRowId: cal.id, googleId: cal.googleId, eventId }
        : { kind: "noop", calendarRowId: cal.id, googleId: cal.googleId };
    }
    return eventId
      ? { kind: "patch", calendarRowId: cal.id, googleId: cal.googleId, eventId }
      : { kind: "insert", calendarRowId: cal.id, googleId: cal.googleId };
  });
}

/**
 * Create, update, or cancel this appointment's event on every calendar the org syncs.
 *
 * Each calendar keeps its own row in `AppointmentGoogleEvent`, so an update or cancel reaches
 * the right event id on each one. A calendar (or an account whose token has been revoked) that
 * fails is caught and recorded against its connection; the rest still sync.
 */
export async function pushAppointment(
  apptId: string,
  action: "create" | "update" | "cancel",
): Promise<void> {
  const appt = await prisma.appointment.findUnique({
    where: { id: apptId },
    include: {
      org: { select: { timezone: true } },
      googleEvents: true,
    },
  });
  if (!appt) return;

  const targets = await syncTargets(appt.orgId);
  if (targets.length === 0) return;

  const body = eventBody(appt, appt.org.timezone);
  const existingByCalendar = new Map(appt.googleEvents.map((e) => [e.calendarId, e]));

  for (const { connection } of targets) {
    let at: string;
    try {
      at = await accessTokenFromRefresh(decryptSecret(connection.refreshToken));
    } catch (err) {
      // The whole account is unreachable (revoked token, etc.) — record once, skip its
      // calendars, and let the other accounts proceed.
      await recordError(connection.id, err);
      continue;
    }

    const ops = planOps(
      connection.calendars
        .map((c) => existingByCalendar.get(c.id))
        .filter((e): e is (typeof appt.googleEvents)[number] => !!e)
        .map((e) => ({ calendarId: e.calendarId, eventId: e.eventId })),
      connection.calendars,
      action,
    );

    let anyOk = false;
    let lastErr: unknown = null;
    for (const op of ops) {
      try {
        if (op.kind === "delete") {
          await deleteEvent(at, op.googleId, op.eventId);
          await prisma.appointmentGoogleEvent
            .deleteMany({ where: { appointmentId: appt.id, calendarId: op.calendarRowId } })
            .catch(() => {});
        } else if (op.kind === "patch") {
          await patchEvent(at, op.googleId, op.eventId, body);
        } else if (op.kind === "insert") {
          const eventId = await insertEvent(at, op.googleId, body);
          // upsert (not create) so a retry after a partial failure does not violate the
          // (appointmentId, calendarId) unique constraint.
          await prisma.appointmentGoogleEvent.upsert({
            where: {
              appointmentId_calendarId: {
                appointmentId: appt.id,
                calendarId: op.calendarRowId,
              },
            },
            create: { appointmentId: appt.id, calendarId: op.calendarRowId, eventId },
            update: { eventId },
          });
        }
        anyOk = true;
      } catch (err) {
        lastErr = err;
      }
    }

    if (lastErr && !anyOk) await recordError(connection.id, lastErr);
    else if (anyOk) await markSynced(connection.id);
  }
}

/**
 * Busy intervals across ALL of the org's synced calendars, for the availability engine.
 *
 * Returns the union so a slot busy on any one calendar is treated as busy. Returns [] when
 * nothing is connected or on error, so a booking always proceeds on our own data rather than
 * being blocked by a Google outage.
 */
export async function googleBusy(
  orgId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ start: Date; end: Date }[]> {
  const targets = await syncTargets(orgId);
  if (targets.length === 0) return [];

  const all: { start: Date; end: Date }[] = [];
  for (const { connection } of targets) {
    let at: string;
    try {
      at = await accessTokenFromRefresh(decryptSecret(connection.refreshToken));
    } catch (err) {
      await recordError(connection.id, err);
      continue;
    }
    let anyOk = false;
    let lastErr: unknown = null;
    for (const calendar of connection.calendars) {
      try {
        const busy = await freeBusy(at, calendar.googleId, rangeStart, rangeEnd);
        all.push(...busy);
        anyOk = true;
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr && !anyOk) await recordError(connection.id, lastErr);
    else if (anyOk) await markSynced(connection.id);
  }
  return all;
}

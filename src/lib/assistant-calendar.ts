/**
 * Calendar tools for a personal-assistant agent.
 *
 * These write to a real calendar, so the shape of every failure matters more than the happy
 * path. Two rules run through all of them:
 *
 *   1. Never report a change that did not happen. If Google refuses, say so plainly and
 *      offer the fallback — the principal acting on a booking that does not exist is worse
 *      than hearing that it failed.
 *   2. Never guess an identity. Cancelling or moving the wrong event is unrecoverable from
 *      the caller's side, so an ambiguous match asks rather than picks.
 */
import { accessTokenFromRefresh, deleteEvent, insertEvent, listEvents, patchEvent } from "@/lib/google";
import { resolveWhen } from "@/lib/assistant-tools";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { formatSlotLabel, formatTimeOnly } from "@/lib/tz";

const DEFAULT_MINUTES = 30;
/** Read no more than this many events aloud. Beyond it, summarise the count instead. */
const SPEAKABLE = 6;

function str(v: unknown): string | undefined {
  const t = typeof v === "string" ? v.trim() : undefined;
  return t && t.length > 0 ? t : undefined;
}

type Conn = { accessToken: string; calendarId: string };

/**
 * The org's calendar connection, or a spoken explanation of why there isn't one.
 *
 * Returned as a value rather than thrown so every caller is forced to handle "not connected"
 * as a normal outcome — it is the most likely one for an org that has never linked Google.
 */
async function connect(orgId: string): Promise<Conn | string> {
  // The personal assistant reads and writes ONE calendar — the principal's own. With
  // multi-calendar sync an org can have several, so this picks the first connected account
  // and its first chosen calendar (falling back to "primary"), rather than the single
  // `calendarId` that no longer exists. Token handling is unchanged from before.
  const conn = await prisma.googleConnection.findFirst({
    where: { orgId },
    include: { calendars: { orderBy: { createdAt: "asc" }, take: 1 } },
    orderBy: { createdAt: "asc" },
  });
  if (!conn) return "The calendar isn't connected yet. I can take a note instead.";
  if (!conn.syncEnabled) return "Calendar syncing is switched off right now. I can take a note instead.";
  try {
    // Decrypt first — the token is stored encrypted (OAuth callback encryptSecret's it) and
    // every other consumer decrypts. Using it raw sent ciphertext to Google as a refresh
    // token, so the personal-assistant calendar tools failed with invalid_grant on every real
    // connection. This corrects that alongside the multi-calendar resolver rewrite.
    const accessToken = await accessTokenFromRefresh(decryptSecret(conn.refreshToken));
    return { accessToken, calendarId: conn.calendars[0]?.googleId ?? "primary" };
  } catch {
    // Usually a revoked refresh token. Nothing the caller can do, so do not make them wait.
    return "I can't reach the calendar at the moment. I'll take a note instead.";
  }
}

/** Window for a spoken range word. Anything else is refused rather than guessed at. */
function windowFor(range: string | undefined, tz: string, now: Date): { from: Date; to: Date; label: string } | null {
  const r = (range ?? "today").toLowerCase().trim();
  const startOfDay = resolveWhen("today at 0", tz, now) ?? now;
  const day = 86_400_000;
  if (r === "today") return { from: now, to: new Date(startOfDay.getTime() + day), label: "today" };
  if (r === "tomorrow")
    return { from: new Date(startOfDay.getTime() + day), to: new Date(startOfDay.getTime() + 2 * day), label: "tomorrow" };
  if (r === "week" || r === "this week")
    return { from: now, to: new Date(startOfDay.getTime() + 7 * day), label: "the next seven days" };
  // A specific date, e.g. "2026-09-01".
  const exact = resolveWhen(r.includes("T") || r.includes(" ") ? r : `${r} 00:00`, tz, now);
  if (exact) return { from: exact, to: new Date(exact.getTime() + day), label: r };
  return null;
}

export async function getCalendar(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  now = new Date(),
): Promise<string> {
  const conn = await connect(orgId);
  if (typeof conn === "string") return conn;

  const win = windowFor(str(args.range) ?? str(args.date), tz, now);
  if (!win) return "Which day should I check? Say today, tomorrow, or a date.";

  const events = await listEvents(conn.accessToken, conn.calendarId, win.from, win.to);
  if (events.length === 0) return `Nothing on ${win.label}.`;

  if (events.length > SPEAKABLE) {
    const first = events[0];
    return `${events.length} things ${win.label}. First is ${first.summary} at ${formatTimeOnly(first.start, tz)}. Want the rest?`;
  }
  const parts = events.map((e) =>
    e.allDay ? `${e.summary}, all day` : `${e.summary} at ${formatTimeOnly(e.start, tz)}`,
  );
  const count = events.length === 1 ? "One thing" : `${events.length} things`;
  return `${count} ${win.label}: ${parts.join("; ")}.`;
}

export async function createCalendarEvent(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  now = new Date(),
): Promise<string> {
  const title = str(args.title) ?? str(args.summary);
  const startRaw = str(args.start) ?? str(args.when) ?? str(args.time);
  if (!title) return "What should I call it?";
  if (!startRaw) return "What time should I put it down for?";

  const start = resolveWhen(startRaw, tz, now);
  // Booking at a guessed time is the failure that matters here: the principal believes an
  // hour is held that isn't. Refuse and ask.
  if (!start) return `I couldn't pin down "${startRaw}". Give me a date and a time.`;

  const end = resolveWhen(str(args.end), tz, now) ?? new Date(start.getTime() + DEFAULT_MINUTES * 60_000);
  const conn = await connect(orgId);
  if (typeof conn === "string") return conn;

  try {
    await insertEvent(conn.accessToken, conn.calendarId, {
      summary: title,
      description: str(args.notes) ?? "",
      start: { dateTime: start.toISOString(), timeZone: tz },
      end: { dateTime: end.toISOString(), timeZone: tz },
    });
  } catch (err) {
    console.error("calendar insert failed", err);
    return "The calendar wouldn't take that one. I'll note it instead and it can go in manually.";
  }
  return `Booked: ${title}, ${formatSlotLabel(start, tz)}.`;
}

/**
 * Find the one event a person means.
 *
 * Returns an event, or a sentence to say. Deliberately refuses to choose between several
 * matches: moving or cancelling the wrong meeting is not something the caller can undo.
 */
async function findOne(
  conn: Conn,
  tz: string,
  args: Record<string, unknown>,
  now: Date,
): Promise<{ id: string; summary: string; start: Date } | string> {
  const query = str(args.title) ?? str(args.summary) ?? str(args.event);
  const win = windowFor(str(args.range) ?? str(args.date) ?? "week", tz, now);
  if (!win) return "Which day is it on?";

  const events = await listEvents(conn.accessToken, conn.calendarId, win.from, win.to);
  const matches = query
    ? events.filter((e) => e.summary.toLowerCase().includes(query.toLowerCase()))
    : events;

  if (matches.length === 0) {
    return query ? `I don't see anything called "${query}".` : `Nothing on ${win.label} to change.`;
  }
  if (matches.length > 1) {
    const when = matches.slice(0, 3).map((m) => formatTimeOnly(m.start, tz)).join(", ");
    return `There are ${matches.length} that match — ${when}. Which one?`;
  }
  return matches[0];
}

export async function updateCalendarEvent(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  now = new Date(),
): Promise<string> {
  const conn = await connect(orgId);
  if (typeof conn === "string") return conn;

  const found = await findOne(conn, tz, args, now);
  if (typeof found === "string") return found;

  const newStartRaw = str(args.start) ?? str(args.new_time) ?? str(args.to);
  const newTitle = str(args.new_title);
  if (!newStartRaw && !newTitle) return "What should I change about it?";

  const patch: Record<string, unknown> = {};
  if (newTitle) patch.summary = newTitle;
  if (newStartRaw) {
    const start = resolveWhen(newStartRaw, tz, now);
    if (!start) return `I couldn't pin down "${newStartRaw}". Give me a date and a time.`;
    patch.start = { dateTime: start.toISOString(), timeZone: tz };
    patch.end = {
      dateTime: new Date(start.getTime() + DEFAULT_MINUTES * 60_000).toISOString(),
      timeZone: tz,
    };
  }

  try {
    await patchEvent(conn.accessToken, conn.calendarId, found.id, patch as never);
  } catch (err) {
    console.error("calendar patch failed", err);
    return "I couldn't change that one. Nothing has moved.";
  }
  const moved = patch.start as { dateTime: string } | undefined;
  return moved
    ? `Moved ${newTitle ?? found.summary} to ${formatSlotLabel(new Date(moved.dateTime), tz)}.`
    : `Renamed it to ${newTitle}.`;
}

export async function cancelCalendarEvent(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  now = new Date(),
): Promise<string> {
  const conn = await connect(orgId);
  if (typeof conn === "string") return conn;

  const found = await findOne(conn, tz, args, now);
  if (typeof found === "string") return found;

  try {
    await deleteEvent(conn.accessToken, conn.calendarId, found.id);
  } catch (err) {
    console.error("calendar delete failed", err);
    return "I couldn't cancel that one. It's still in the calendar.";
  }
  return `Cancelled ${found.summary}, ${formatSlotLabel(found.start, tz)}.`;
}

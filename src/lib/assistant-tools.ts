/**
 * Capture tools for a personal-assistant agent: notes, tasks, reminders.
 *
 * These return strings that get spoken, so they are written to be said out loud — short,
 * and confirming exactly what was captured. The assistant's prompt promises to "read back
 * the reminder time"; that only means anything if the string it reads back is the time that
 * was actually stored.
 *
 * The rule throughout: never report a capture that did not happen. An assistant that says
 * "got it, filed under Bilco" when nothing was written is worse than one that says it
 * cannot — the principal stops checking.
 */
import { prisma } from "@/lib/db";
import { formatSlotLabel, wallTime, zonedToUtc } from "@/lib/tz";

/** Longest note we will store from one turn. Beyond this something has gone wrong upstream. */
const MAX_NOTE_CHARS = 4000;

function str(v: unknown): string | undefined {
  const t = typeof v === "string" ? v.trim() : undefined;
  return t && t.length > 0 ? t : undefined;
}

/**
 * Resolve what a person said about time into an instant.
 *
 * Deliberately narrow. It accepts an ISO timestamp, an ISO local datetime, and a handful of
 * plain forms — and returns null for everything else rather than guessing. A reminder set to
 * the wrong time is worse than one that was refused: the refusal is audible on the call, the
 * wrong time is discovered by missing whatever it was for.
 */
export function resolveWhen(raw: string | undefined, tz: string, now = new Date()): Date | null {
  const text = raw?.trim();
  if (!text) return null;

  // Full ISO with an offset or Z — unambiguous, take it as given.
  if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})/.test(text)) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Local ISO, no offset: interpret in the org's timezone rather than the server's.
  const local = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (local) {
    const [, y, mo, d, h, mi] = local;
    return zonedToUtc(+y, +mo, +d, +h * 60 + +mi, tz);
  }

  // "in 20 minutes" / "in 2 hours" / "in 3 days" — relative to now, no timezone maths needed.
  const rel = text.match(/^in\s+(\d{1,3})\s*(min(?:ute)?s?|h(?:ou)?rs?|days?)\b/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit.startsWith("min") ? 60_000 : unit.startsWith("h") ? 3_600_000 : 86_400_000;
    return new Date(now.getTime() + n * ms);
  }

  // "today at 15:00" / "tomorrow at 9:30" — the two relative days worth supporting, because
  // they are what people actually say to an assistant on the phone.
  const day = text.match(/^(today|tomorrow)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (day) {
    const w = wallTime(now, tz);
    let hour = Number(day[2]);
    const minute = day[3] ? Number(day[3]) : 0;
    const mer = day[4]?.toLowerCase();
    if (mer === "pm" && hour < 12) hour += 12;
    if (mer === "am" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59) return null;
    const base = zonedToUtc(w.y, w.mo, w.d, hour * 60 + minute, tz);
    return day[1].toLowerCase() === "tomorrow" ? new Date(base.getTime() + 86_400_000) : base;
  }

  return null;
}

export async function captureNote(
  orgId: string,
  args: Record<string, unknown>,
  callId?: string,
): Promise<string> {
  const text = str(args.text) ?? str(args.note) ?? str(args.body);
  if (!text) {
    return "Nothing was captured — the note was empty. Ask what to file, then try again.";
  }
  const project = str(args.project);
  await prisma.note.create({
    data: {
      orgId,
      text: text.slice(0, MAX_NOTE_CHARS),
      project: project ?? null,
      sourceCallId: callId ?? null,
    },
  });
  return project ? `Got it — filed under ${project}.` : "Got it — filed.";
}

export async function addTask(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  callId?: string,
): Promise<string> {
  const title = str(args.title) ?? str(args.task) ?? str(args.text);
  if (!title) {
    return "Nothing was added — no task was given. Ask what the task is, then try again.";
  }
  const dueRaw = str(args.due) ?? str(args.due_at) ?? str(args.when);
  const dueAt = resolveWhen(dueRaw, tz);

  // A stated deadline we could not parse must not be silently dropped: the principal would
  // believe it was captured with a date. Store the task, and say plainly it has no date.
  const unparsedDue = Boolean(dueRaw) && dueAt === null;

  const project = str(args.project);
  await prisma.task.create({
    data: {
      orgId,
      kind: "TASK",
      title,
      project: project ?? null,
      dueAt,
      sourceCallId: callId ?? null,
    },
  });

  if (unparsedDue) {
    return `Added "${title}", but I couldn't pin down "${dueRaw}" — it's on the list with no date. Give me a date and time and I'll set it.`;
  }
  if (dueAt) return `Added "${title}", due ${formatSlotLabel(dueAt, tz)}.`;
  return project ? `Added "${title}" under ${project}.` : `Added "${title}".`;
}

export async function setReminder(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  callId?: string,
): Promise<string> {
  const text = str(args.text) ?? str(args.title) ?? str(args.reminder);
  const whenRaw = str(args.time) ?? str(args.when) ?? str(args.due);
  if (!text) {
    return "Nothing was set — no reminder text. Ask what to be reminded about, then try again.";
  }

  const dueAt = resolveWhen(whenRaw, tz);
  // Unlike a task, a reminder IS its time. Storing one we cannot schedule would be a silent
  // failure discovered by it never arriving, so refuse and say so on the call.
  if (!dueAt) {
    return whenRaw
      ? `I couldn't pin down "${whenRaw}". Give me a date and a time and I'll set it.`
      : "What time should I set that for?";
  }

  await prisma.task.create({
    data: {
      orgId,
      kind: "REMINDER",
      title: text,
      dueAt,
      sourceCallId: callId ?? null,
    },
  });
  return `Reminder set: ${text}, ${formatSlotLabel(dueAt, tz)}.`;
}

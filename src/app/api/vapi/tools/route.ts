import { NextRequest, NextResponse } from "next/server";
import { openSlots, validateSlot, getCalendarConfig } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { addTask, captureNote, setReminder } from "@/lib/assistant-tools";
import { NOT_PRINCIPAL, isPrincipal } from "@/lib/assistant-principal";
import {
  cancelCalendarEvent,
  createCalendarEvent,
  getCalendar,
  updateCalendarEvent,
} from "@/lib/assistant-calendar";
import { pushAppointment } from "@/lib/google-sync";
import { resolveCallOrg, resolveTenantKey } from "@/lib/tenant-key";
import { formatSlotLabel } from "@/lib/tz";
import { fireWebhook } from "@/lib/webhook";
import { pushLeadToJobber } from "@/lib/jobber-sync";
import { sendSmsToCustomer } from "@/lib/sms";
import { normalizePhone } from "@/lib/phone";

// Vapi in-call tool dispatcher. The assistant's function tools all point
// here; we dispatch on function name and answer in Vapi's expected
// { results: [{ toolCallId, result }] } shape. Results are strings the
// voice model reads, so they're written to be speakable.

type ToolCall = {
  id?: string;
  name?: string;
  function?: { name?: string; arguments?: unknown };
  arguments?: unknown;
};

/** Tools that only the principal may invoke. Membership here is the access decision. */
const CALENDAR_TOOLS = new Set([
  "get_calendar",
  "create_calendar_event",
  "update_calendar_event",
  "cancel_calendar_event",
]);

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function s(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

async function checkAvailability(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
): Promise<string> {
  const dateArg = s(args.date); // optional YYYY-MM-DD
  let from: Date | undefined;
  let days = 7;
  if (dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
    from = new Date(`${dateArg}T00:00:00.000Z`);
    days = 1;
  }

  const slots = await openSlots(orgId, { from, days, max: 6 });
  if (slots.length === 0) {
    const cfg = await getCalendarConfig(orgId);
    if (cfg.rules.length === 0) {
      return "The booking calendar is not configured. Do not offer appointment times; take a detailed message instead.";
    }
    return dateArg
      ? `No openings on ${dateArg}. Ask if another day works, then check again without a date.`
      : "No openings in the next week. Apologize and take a detailed message so the office can call back to schedule.";
  }

  const lines = slots.map(
    (slot) =>
      `${formatSlotLabel(slot.start, tz)} [slotStart: ${slot.start.toISOString()}]`,
  );
  return (
    `Open slots (offer the caller at most two, starting with the earliest):\n` +
    lines.join("\n") +
    `\nWhen booking, pass the exact bracketed slotStart value.`
  );
}

function tenDigits(p?: string | null): string {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

// Upcoming (CONFIRMED/PENDING) appointments for a caller, soonest first.
async function upcomingByPhone(orgId: string, phone: string) {
  const appts = await prisma.appointment.findMany({
    where: { orgId, status: { in: ["CONFIRMED", "PENDING"] }, startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });
  const t = tenDigits(phone);
  return appts.filter((a) => tenDigits(a.customerPhone) === t);
}

// Stamp what the AI did this call (keyed by Vapi call id, before the Call row
// exists). The end-of-call ingest reads these to set the call's outcome.
async function recordAction(
  orgId: string,
  vapiCallId: string | undefined,
  kind: "BOOK" | "RESCHEDULE" | "CANCEL" | "MESSAGE",
  detail?: string,
): Promise<void> {
  if (!vapiCallId) return;
  await prisma.callAction
    .create({ data: { orgId, vapiCallId, kind, detail } })
    .catch((err) => console.error("recordAction failed", { vapiCallId, kind }, err));
}

type BookResult = { ok: boolean; message: string; label?: string };

async function bookCore(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  vapiCallId: string | undefined,
): Promise<BookResult> {
  const name = s(args.name);
  const phone = s(args.phone);
  const slotStart = s(args.slotStart);
  if (!name || !phone || !slotStart) {
    return { ok: false, message: "Missing required details. Collect the caller's name, callback number, and a chosen time slot, then try again." };
  }
  const start = new Date(slotStart);
  if (isNaN(start.getTime())) {
    return { ok: false, message: "That time was not understood. Run check_availability again and use the exact bracketed slotStart value." };
  }

  const cfg = await getCalendarConfig(orgId);
  const durationMinutes =
    typeof args.durationMinutes === "number" && args.durationMinutes >= 30
      ? Math.min(args.durationMinutes, 480)
      : cfg.slotMinutes;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const emergency = args.emergency === true;

  const check = await validateSlot(orgId, start, end, { emergency });
  if (!check.ok) {
    return { ok: false, message: `Could not book: ${check.reason}. Run check_availability again and offer the caller a different time.` };
  }

  const jobType = s(args.jobType);
  const appt = await prisma.appointment.create({
    data: {
      orgId,
      vapiCallId,
      title: `${jobType ?? "Service call"} — ${name}`,
      customerName: name,
      customerPhone: phone,
      address: s(args.address),
      jobType,
      notes: s(args.notes),
      startsAt: start,
      endsAt: end,
      source: "AI",
      status: cfg.bookingPolicy === "CONFIRM_FIRST" ? "PENDING" : "CONFIRMED",
    },
  });

  void pushAppointment(appt.id, "create").catch(() => {});
  void fireWebhook(orgId, "appointment.created", {
    id: appt.id,
    customerName: appt.customerName,
    customerPhone: appt.customerPhone,
    address: appt.address,
    jobType: appt.jobType,
    startsAt: appt.startsAt.toISOString(),
    endsAt: appt.endsAt.toISOString(),
    status: appt.status,
    source: "AI",
  }).catch(() => {});

  const label = formatSlotLabel(appt.startsAt, tz);
  if (appt.status === "CONFIRMED") {
    void sendSmsToCustomer({
      orgId,
      toE164: phone,
      body: `You're booked for ${label}. Reply here if you need to change it.`,
      template: "booking-confirmation",
      appointmentId: appt.id,
    }).catch(() => {});
  }
  return {
    ok: true,
    label,
    message:
      appt.status === "CONFIRMED"
        ? `Booked: ${label} for ${name}. Confirm the date and time back to the caller and let them know they're all set.`
        : `Requested: ${label} for ${name}. Tell the caller the owner will confirm this time shortly by text or call.`,
  };
}

async function bookAppointment(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  vapiCallId: string | undefined,
): Promise<string> {
  const r = await bookCore(orgId, tz, args, vapiCallId);
  if (r.ok) await recordAction(orgId, vapiCallId, "BOOK", r.label);
  return r.message;
}

// Lets the AI see what the caller already has booked, so it can confirm before
// changing or cancelling. Defaults to the number the caller is calling from.
async function findAppointments(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  callerNumber: string | undefined,
): Promise<string> {
  const phone = s(args.phone) ?? callerNumber;
  if (!phone) return "Ask the caller for the phone number their appointment is booked under.";
  const matches = await upcomingByPhone(orgId, phone);
  if (matches.length === 0) {
    return "I don't see any upcoming appointments under that number. If they think there should be one, ask them for the number it was booked under.";
  }
  const list = matches
    .map((a) => `${formatSlotLabel(a.startsAt, tz)}${a.jobType ? ` (${a.jobType})` : ""}`)
    .join("; ");
  return `Found ${matches.length === 1 ? "an upcoming appointment" : `${matches.length} upcoming appointments`}: ${list}. Read it back to confirm, then use reschedule_appointment to move it or cancel_appointment to cancel.`;
}

async function cancelAppointment(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  callerNumber: string | undefined,
  vapiCallId: string | undefined,
): Promise<string> {
  const phone = s(args.phone) ?? callerNumber;
  if (!phone) return "I need the phone number the appointment is under to cancel it.";
  const matches = await upcomingByPhone(orgId, phone);
  if (matches.length === 0) {
    return "I don't see an upcoming appointment under that number. Offer to take a message instead.";
  }
  const target = matches[0]; // soonest
  await prisma.appointment.update({ where: { id: target.id }, data: { status: "CANCELLED" } });
  void pushAppointment(target.id, "cancel").catch(() => {});
  const label = formatSlotLabel(target.startsAt, tz);
  await recordAction(orgId, vapiCallId, "CANCEL", label);
  return `Cancelled the appointment for ${label}. Confirm to the caller it's cancelled.`;
}

// Reschedule = book the NEW slot first; only if that succeeds, cancel the old
// one(s). This guarantees the caller is never left with no appointment.
async function rescheduleAppointment(
  orgId: string,
  tz: string,
  args: Record<string, unknown>,
  vapiCallId: string | undefined,
  callerNumber: string | undefined,
): Promise<string> {
  const phone = s(args.phone) ?? callerNumber;
  const slotStart = s(args.slotStart);
  if (!phone || !slotStart) {
    return "To move an appointment I need the caller's number and the new time from check_availability.";
  }
  // bookCore reads the chosen number from args.phone — make sure the resolved
  // number (which may be the caller ID) is what it sees.
  args.phone = phone;
  const matches = await upcomingByPhone(orgId, phone);
  // Carry over name/job from the existing booking if the caller didn't restate them.
  if (matches.length) {
    if (!s(args.name)) args.name = matches[0].customerName ?? undefined;
    if (!s(args.jobType)) args.jobType = matches[0].jobType ?? undefined;
  }

  // Cancel the old booking FIRST so its time (and travel buffer) doesn't block
  // the new slot — common when moving to an adjacent time. Remember prior
  // statuses so we can restore if the new booking can't be made.
  const prior = matches.map((m) => ({ id: m.id, status: m.status }));
  const oldLabel = matches.length ? formatSlotLabel(matches[0].startsAt, tz) : "";
  for (const m of matches) {
    await prisma.appointment.update({ where: { id: m.id }, data: { status: "CANCELLED" } });
  }

  const booked = await bookCore(orgId, tz, args, vapiCallId);
  if (!booked.ok) {
    // Restore the original(s) — the caller keeps their existing appointment.
    for (const p of prior) {
      await prisma.appointment.update({ where: { id: p.id }, data: { status: p.status } });
    }
    return matches.length
      ? `That new time isn't available, so I kept the original appointment (${oldLabel}). ${booked.message}`
      : booked.message;
  }

  // New booking succeeded — push the cancellations to Google now.
  for (const p of prior) void pushAppointment(p.id, "cancel").catch(() => {});
  // A genuine move is RESCHEDULE; with no prior match it's effectively a new BOOK.
  await recordAction(
    orgId,
    vapiCallId,
    matches.length ? "RESCHEDULE" : "BOOK",
    matches.length ? `${oldLabel} → ${booked.label ?? "new time"}` : booked.label,
  );
  return matches.length
    ? `Moved the appointment from ${oldLabel} to the new time — old one cancelled. ${booked.message}`
    : `No prior appointment was found under that number, so I booked a new one. ${booked.message}`;
}

async function takeMessage(
  orgId: string,
  args: Record<string, unknown>,
  vapiCallId: string | undefined,
): Promise<string> {
  const rawPhone = s(args.phone);
  const message = s(args.message);
  if (!rawPhone || !message) {
    return "Missing details. Collect the caller's callback number and the message itself, then try again.";
  }
  const phone = normalizePhone(rawPhone)!;
  const name = s(args.name);
  // One lead per caller: enrich an existing lead for this number, or create it.
  const existing = await prisma.lead.findUnique({
    where: { orgId_phone: { orgId, phone } },
  });
  const lead = await prisma.lead.upsert({
    where: { orgId_phone: { orgId, phone } },
    create: {
      orgId,
      vapiCallId,
      name,
      phone,
      jobType: s(args.jobType),
      address: s(args.address),
      urgency: s(args.urgency),
      notes: message,
      status: "NEW",
    },
    update: {
      vapiCallId,
      name: existing?.name ?? name,
      jobType: existing?.jobType ?? s(args.jobType),
      address: existing?.address ?? s(args.address),
      urgency: existing?.urgency ?? s(args.urgency),
      notes: message,
    },
  });
  await prisma.leadActivity.create({
    data: {
      orgId,
      leadId: lead.id,
      actor: "AI",
      kind: "NOTE",
      payload: { text: `Message taken: ${message}` },
    },
  });
  void fireWebhook(orgId, existing ? "lead.updated" : "lead.created", {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    jobType: lead.jobType,
    address: lead.address,
    urgency: lead.urgency,
    notes: lead.notes,
    source: "AI",
  }).catch(() => {});
  if (!existing) {
    void pushLeadToJobber(orgId, lead.id, {
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      jobType: lead.jobType,
    }).catch(() => {});
  }
  await recordAction(orgId, vapiCallId, "MESSAGE", lead.jobType ?? undefined);
  return `Message recorded for the office. Tell ${name ?? "the caller"} the team will call back as soon as possible.`;
}

export async function POST(req: NextRequest) {
  const key = await resolveTenantKey(req);
  if (!key) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const msg = (body.message ?? body) as Record<string, unknown> & {
    toolCallList?: ToolCall[];
    toolCalls?: ToolCall[];
    call?: {
      id?: string;
      customer?: { number?: string };
      // The number that was *dialled*. For an ENGINE key this decides the tenant, so it is
      // read from the payload but never trusted as an org claim — it is looked up.
      phoneNumber?: { number?: string };
    };
  };
  const vapiCallId = s(msg.call?.id);
  // The number the caller is dialing from — used to look up their existing
  // appointments without making them recite the number.
  const callerNumber = s(msg.call?.customer?.number);
  const dialledNumber = normalizePhone(s(msg.call?.phoneNumber?.number));

  // The engine answers for every client, so the org comes from the dialled number, not from
  // the key. Resolved before any tool runs: a tool that writes to the wrong tenant has
  // already done the damage by the time anyone notices.
  const callOrg = await resolveCallOrg(key, dialledNumber);
  if (!callOrg.ok) {
    console.warn("tool call rejected", callOrg.error, { dialledNumber, scope: key.scope });
    return NextResponse.json({ error: callOrg.error }, { status: callOrg.status });
  }
  const orgId = callOrg.orgId;

  const list: ToolCall[] = msg.toolCallList ?? msg.toolCalls ?? [];

  // Manual/diagnostic form: {"function": "...", "arguments": {...}}
  if (list.length === 0 && typeof body.function === "string") {
    list.push({ id: "manual", name: body.function, arguments: body.arguments });
  }
  if (list.length === 0) {
    return NextResponse.json({ error: "no tool calls" }, { status: 400 });
  }

  const tz = callOrg.org.timezone;
  const results = [];
  for (const tc of list) {
    const fnName = tc.function?.name ?? tc.name ?? "";
    const args = parseArgs(tc.function?.arguments ?? tc.arguments);
    let result: string;
    try {
      if (fnName === "check_availability") {
        result = await checkAvailability(orgId, tz, args);
      } else if (fnName === "book_appointment") {
        result = await bookAppointment(orgId, tz, args, vapiCallId);
      } else if (fnName === "take_message") {
        result = await takeMessage(orgId, args, vapiCallId);
      } else if (fnName === "find_appointments") {
        result = await findAppointments(orgId, tz, args, callerNumber);
      } else if (fnName === "reschedule_appointment") {
        result = await rescheduleAppointment(orgId, tz, args, vapiCallId, callerNumber);
      } else if (fnName === "cancel_appointment") {
        result = await cancelAppointment(orgId, tz, args, callerNumber, vapiCallId);
      // --- personal-assistant capture tools -------------------------------------------
      // Ada's prompt has promised these since it was written, with nothing behind them. An
      // assistant that says "got it, filed under Bilco" and writes nothing is worse than one
      // that admits it cannot: the principal stops checking.
      } else if (fnName === "capture_note") {
        result = await captureNote(orgId, args, vapiCallId);
      } else if (fnName === "add_task") {
        result = await addTask(orgId, tz, args, vapiCallId);
      } else if (fnName === "set_reminder") {
        result = await setReminder(orgId, tz, args, vapiCallId);
      // --- principal-only: these read and write a real personal calendar ------------------
      // Gated in code rather than by prompt instruction. A model told "never disclose his
      // schedule" can be talked out of it; this cannot be, because the tool does not run.
      } else if (CALENDAR_TOOLS.has(fnName)) {
        if (!(await isPrincipal(orgId, callerNumber))) {
          console.warn("calendar tool refused for non-principal caller", fnName);
          result = NOT_PRINCIPAL;
        } else if (fnName === "get_calendar") {
          result = await getCalendar(orgId, tz, args);
        } else if (fnName === "create_calendar_event") {
          result = await createCalendarEvent(orgId, tz, args);
        } else if (fnName === "update_calendar_event") {
          result = await updateCalendarEvent(orgId, tz, args);
        } else {
          result = await cancelCalendarEvent(orgId, tz, args);
        }
      } else {
        // Spoken, so it has to be usable on a call: say what cannot be done and offer the
        // fallback, rather than reading a tool name at the caller.
        console.warn("unknown tool requested", fnName);
        result =
          "I can't do that one yet. Take a message with the details instead, and say it will be picked up.";
      }
    } catch (err) {
      console.error("tool call failed", fnName, err);
      result =
        "A system error occurred. Apologize and take a detailed message instead.";
    }
    results.push({ toolCallId: tc.id ?? "unknown", result });
  }

  await prisma.ingestKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return NextResponse.json({ results });
}

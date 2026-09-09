// Plain, dependency-free HTML email templates. Kept simple and inline-styled
// for deliverability. One brand system (emerald accent, system fonts).
import { formatWhen } from "@/lib/format";

const WRAP_OPEN = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b;line-height:1.5">`;
const WRAP_CLOSE = `<p style="margin-top:28px;font-size:12px;color:#a1a1aa">Sent by TwoRing on behalf of your business · <a href="https://tworing.ai" style="color:#059669">tworing.ai</a></p></div>`;

function row(label: string, value?: string | null): string {
  if (!value) return "";
  return `<tr><td style="padding:4px 12px 4px 0;color:#71717a;font-size:14px">${label}</td><td style="padding:4px 0;font-size:14px"><strong>${escapeHtml(value)}</strong></td></tr>`;
}

/**
 * The transcript as a readable conversation. Stored as "AI: …" / "User: …" lines (one per
 * turn); rendered as labelled rows so the owner can read the whole exchange in the email
 * instead of only the summary. Unlabelled lines are kept as-is.
 */
export function conversationHtml(transcript: string): string {
  const rows = transcript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(AI|Assistant|User|Caller):\s*(.*)$/i.exec(line);
      const who = m ? (/^(AI|Assistant)$/i.test(m[1]) ? "Receptionist" : "Caller") : "";
      const text = m ? m[2] : line;
      const color = who === "Caller" ? "#18181b" : "#059669";
      return `<tr><td style="padding:3px 10px 3px 0;color:${color};font-size:13px;white-space:nowrap;vertical-align:top"><strong>${who}</strong></td><td style="padding:3px 0;font-size:14px">${escapeHtml(text)}</td></tr>`;
    });
  return `<table style="border-collapse:collapse;margin:0 0 16px">${rows.join("")}</table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function leadSummaryEmail(opts: {
  orgName: string;
  tz: string;
  callerName?: string | null;
  callerNumber?: string | null;
  startedAt: Date;
  summary?: string | null;
  jobType?: string | null;
  address?: string | null;
  urgency?: string | null;
  booked?: boolean;
  /** The full conversation, when the owner should be able to read it all without opening the portal. */
  transcript?: string | null;
  /** Deep link target; the button opens this call rather than the dashboard. */
  callId?: string | null;
}): { subject: string; html: string } {
  const who = opts.callerName ?? opts.callerNumber ?? "A caller";
  const portalUrl = opts.callId ? `https://tworing.ai/app/calls/${opts.callId}` : "https://tworing.ai/app";
  const subject = opts.booked
    ? `New booking: ${who}${opts.jobType ? ` — ${opts.jobType}` : ""}`
    : `New lead: ${who}${opts.jobType ? ` — ${opts.jobType}` : ""}`;
  const html =
    WRAP_OPEN +
    `<h2 style="font-size:18px;margin:0 0 4px">${opts.booked ? "Your AI receptionist booked a job" : "Your AI receptionist captured a lead"}</h2>` +
    `<p style="color:#71717a;font-size:13px;margin:0 0 16px">${formatWhen(opts.startedAt, opts.tz)}</p>` +
    (opts.summary
      ? `<p style="background:#f4f4f5;border-radius:8px;padding:12px 14px;font-size:14px;margin:0 0 16px">${escapeHtml(opts.summary)}</p>`
      : "") +
    `<table style="border-collapse:collapse">` +
    row("Caller", opts.callerName) +
    row("Phone", opts.callerNumber) +
    row("Job", opts.jobType) +
    row("Address", opts.address) +
    row("Urgency", opts.urgency) +
    `</table>` +
    (opts.transcript
      ? `<h3 style="font-size:14px;margin:20px 0 6px">Full conversation</h3>` + conversationHtml(opts.transcript)
      : "") +
    `<p style="margin-top:20px"><a href="${portalUrl}" style="background:#18181b;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px;display:inline-block">${opts.callId ? "Open this call" : "Open your portal"}</a></p>` +
    WRAP_CLOSE;
  return { subject, html };
}

export function bookingConfirmationEmail(opts: {
  orgName: string;
  tz: string;
  customerName?: string | null;
  jobType?: string | null;
  startsAt: Date;
  address?: string | null;
}): { subject: string; html: string } {
  const subject = `Appointment confirmed — ${formatWhen(opts.startsAt, opts.tz)}`;
  const html =
    WRAP_OPEN +
    `<h2 style="font-size:18px;margin:0 0 12px">Appointment confirmed</h2>` +
    `<table style="border-collapse:collapse">` +
    row("Customer", opts.customerName) +
    row("Job", opts.jobType) +
    row("When", formatWhen(opts.startsAt, opts.tz)) +
    row("Address", opts.address) +
    `</table>` +
    WRAP_CLOSE;
  return { subject, html };
}

export function inboundSmsEmail(opts: {
  tz: string;
  customerPhone: string;
  message: string;
  threadId: string;
  receivedAt: Date;
}): { subject: string; html: string } {
  const subject = `New text from ${opts.customerPhone}`;
  const html =
    WRAP_OPEN +
    `<h2 style="font-size:18px;margin:0 0 4px">A customer texted back</h2>` +
    `<p style="color:#71717a;font-size:13px;margin:0 0 16px">${escapeHtml(opts.customerPhone)} · ${formatWhen(opts.receivedAt, opts.tz)}</p>` +
    `<p style="background:#f4f4f5;border-radius:8px;padding:12px 14px;font-size:14px;margin:0 0 16px">${escapeHtml(opts.message)}</p>` +
    `<p style="margin-top:20px"><a href="https://tworing.ai/app/messages/${opts.threadId}" style="background:#18181b;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px;display:inline-block">Reply in your portal</a></p>` +
    WRAP_CLOSE;
  return { subject, html };
}

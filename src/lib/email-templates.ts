// Plain, dependency-free HTML email templates. Kept simple and inline-styled
// for deliverability. One brand system (emerald accent, system fonts).
import { formatWhen } from "@/lib/format";

const WRAP_OPEN = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b;line-height:1.5">`;
const WRAP_CLOSE = `<p style="margin-top:28px;font-size:12px;color:#a1a1aa">Sent by TwoRing on behalf of your business · <a href="https://tworing.ai" style="color:#059669">tworing.ai</a></p></div>`;

function row(label: string, value?: string | null): string {
  if (!value) return "";
  return `<tr><td style="padding:4px 12px 4px 0;color:#71717a;font-size:14px">${label}</td><td style="padding:4px 0;font-size:14px"><strong>${escapeHtml(value)}</strong></td></tr>`;
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
}): { subject: string; html: string } {
  const who = opts.callerName ?? opts.callerNumber ?? "A caller";
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
    `<p style="margin-top:20px"><a href="https://tworing.ai/app" style="background:#18181b;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px;display:inline-block">Open your portal</a></p>` +
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

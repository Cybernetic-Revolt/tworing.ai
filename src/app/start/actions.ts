"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { provisionTrial } from "@/lib/provision";

const RESEND_URL = "https://api.resend.com/emails";
// Where trial requests land. Override with SIGNUP_NOTIFY_EMAIL in the env.
const NOTIFY = process.env.SIGNUP_NOTIFY_EMAIL || "message@bilco.ca";

function s(v: FormDataEntryValue | null, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fromAddress(): string {
  const domain = process.env.MAIL_FROM_DOMAIN;
  if (domain && process.env.MAIL_DOMAIN_VERIFIED === "1") {
    return `TwoRing <hello@${domain}>`;
  }
  return "TwoRing <onboarding@resend.dev>";
}

/**
 * The email that turns a form submission into a usable account.
 *
 * Carries the one-time link to set a password, and the number if one was assigned. It does
 * not claim the line is live when it is not: a trial that says "your number is ready" and
 * gives none is worse than one that says a number is coming.
 */
async function sendWelcome(opts: {
  to: string;
  name: string;
  business: string;
  setPasswordUrl: string;
  e164: string | null;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const first = opts.name.trim().split(/\s+/)[0] || "there";
  const line = opts.e164
    ? `<p>Your trial line is <strong>${esc(opts.e164)}</strong>. Call it now and your receptionist will answer. ` +
      `When you are ready for real calls, forward your business number to it.</p>`
    : `<p>We are assigning your trial number and will email it shortly. Everything else is ready.</p>`;
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b;line-height:1.5">` +
    `<h2 style="font-size:18px;margin:0 0 12px">Your TwoRing trial is ready, ${esc(first)}</h2>` +
    `<p>We have set up ${esc(opts.business)} with a receptionist that answers, takes messages and books jobs into your calendar.</p>` +
    line +
    `<p style="margin:20px 0"><a href="${opts.setPasswordUrl}" style="background:#18181b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;display:inline-block">Set your password and sign in</a></p>` +
    `<p style="font-size:13px;color:#71717a">That link works once and expires in seven days. Two weeks free, no card. Reply to this email if anything looks wrong.</p>` +
    `</div>`;
  await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [opts.to],
      reply_to: NOTIFY,
      subject: `Your TwoRing trial for ${opts.business}`,
      html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
}

export async function submitSignup(formData: FormData): Promise<void> {
  const business = s(formData.get("business"));
  const name = s(formData.get("name"));
  const email = s(formData.get("email"), 160).toLowerCase();
  const phone = s(formData.get("phone"), 40);
  const trade = s(formData.get("trade"), 60) || null;
  const city = s(formData.get("city"), 80) || null;
  const notes = s(formData.get("notes"), 1000) || null;

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (!business || !name || !emailOk || phone.replace(/\D/g, "").length < 7) {
    redirect("/start?error=1");
  }

  // The durable record — never lost even if the notification email fails.
  await prisma.signup
    .create({ data: { business, name, email, phone, trade, city, notes } })
    .catch(() => null);

  // Build them a working account. Deliberately after the Signup row and before the founder
  // email, so the notification can say what actually happened. A failure here costs the
  // automation and never the lead: the row is already saved and the email still goes out.
  let provisioned: Awaited<ReturnType<typeof provisionTrial>> = null;
  let provisionError: string | null = null;
  try {
    provisioned = await provisionTrial({ business, name, email, phone, trade, city });
  } catch (err) {
    provisionError = String(err).slice(0, 300);
    console.error("trial provisioning failed", { email, business }, err);
  }

  if (provisioned) {
    await sendWelcome({
      to: email,
      name,
      business,
      setPasswordUrl: provisioned.setPasswordUrl,
      e164: provisioned.e164,
    }).catch((err) => console.error("welcome email failed", email, err));
  }

  // Notify the founder (best effort). Reply-to is the prospect so a reply
  // starts the conversation directly.
  if (process.env.RESEND_API_KEY) {
    const rows = [
      `Email: ${esc(email)}`,
      `Phone: ${esc(phone)}`,
      trade ? `Trade: ${esc(trade)}` : "",
      city ? `City: ${esc(city)}` : "",
      notes ? `Notes: ${esc(notes)}` : "",
    ]
      .filter(Boolean)
      .map((r) => `<li>${r}</li>`)
      .join("");
    const outcome = provisionError
      ? `<p style="color:#b91c1c"><strong>Provisioning FAILED</strong> — set them up by hand. ${esc(provisionError)}</p>`
      : !provisioned
        ? `<p><strong>Not provisioned</strong> — that email already owns an org, so nothing was created.</p>`
        : `<p><strong>Provisioned automatically.</strong> Org <code>${esc(provisioned.slug)}</code>, ` +
          (provisioned.e164
            ? `line <strong>${esc(provisioned.e164)}</strong>.`
            : `<span style="color:#b91c1c">no number assigned.</span>`) +
          (provisioned.warnings.length
            ? `<br>Needs attention: ${esc(provisioned.warnings.join("; "))}`
            : "") +
          `</p>`;
    const html = `<h2>New TwoRing trial request</h2><p><strong>${esc(business)}</strong> — ${esc(name)}</p><ul>${rows}</ul>${outcome}`;
    await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [NOTIFY],
        reply_to: email,
        subject: `New signup: ${business}`,
        html,
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  }

  redirect(provisioned ? "/start?ready=1" : "/start?sent=1");
}

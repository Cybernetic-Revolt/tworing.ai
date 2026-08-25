"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

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
    const html = `<h2>New TwoRing trial request</h2><p><strong>${esc(business)}</strong> — ${esc(name)}</p><ul>${rows}</ul><p>Reply to this email to reach them and start the 2-week trial.</p>`;
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

  redirect("/start?sent=1");
}

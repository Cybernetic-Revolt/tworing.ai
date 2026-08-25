"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

const RESEND_URL = "https://api.resend.com/emails";
const TTL_MS = 60 * 60 * 1000; // 1 hour

function fromAddress(): string {
  const domain = process.env.MAIL_FROM_DOMAIN;
  if (domain && process.env.MAIL_DOMAIN_VERIFIED === "1") {
    return `TwoRing <hello@${domain}>`;
  }
  return "TwoRing <onboarding@resend.dev>";
}

export async function requestReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  // Only ever land on the same "sent" state — never reveal whether an account
  // exists (no user enumeration).
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(raw).digest("hex");
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      });
      const base = process.env.PLATFORM_URL ?? "https://tworing.ai";
      const link = `${base}/reset?token=${raw}`;
      if (process.env.RESEND_API_KEY) {
        const html = `<p>Someone (hopefully you) asked to reset the password for your TwoRing account.</p><p><a href="${link}">Set a new password</a> — this link expires in one hour and can only be used once.</p><p>If you didn't request this, you can safely ignore this email; your password won't change.</p>`;
        await fetch(RESEND_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress(),
            to: [email],
            subject: "Reset your TwoRing password",
            html,
          }),
          signal: AbortSignal.timeout(10_000),
        }).catch(() => {});
      }
    }
  }
  redirect("/forgot?sent=1");
}

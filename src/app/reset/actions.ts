"use server";

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export async function completeReset(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const withToken = (p: string) =>
    `/reset?token=${encodeURIComponent(token)}&${p}`;

  if (next.length < 10) redirect(withToken("error=weak"));
  if (next !== confirm) redirect(withToken("error=mismatch"));

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const pr = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!pr || pr.usedAt || pr.expiresAt < new Date()) {
    redirect("/reset?error=invalid");
  }

  const passwordHash = await bcrypt.hash(next, 12);
  // Set the new password, revoke every outstanding session (sessionEpoch bump),
  // and burn the token — all atomically.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: pr.userId },
      data: { passwordHash, sessionEpoch: { increment: 1 } },
    }),
    prisma.passwordReset.update({
      where: { id: pr.id },
      data: { usedAt: new Date() },
    }),
  ]);
  redirect("/login?reset=1");
}

"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function changePassword(formData: FormData): Promise<void> {
  const session = await requireSession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 10) redirect("/app/account?error=weak");
  if (next !== confirm) redirect("/app/account?error=mismatch");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  const ok =
    user?.passwordHash != null &&
    (await bcrypt.compare(current, user.passwordHash));
  if (!ok || !user) redirect("/app/account?error=current");

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(next, 12),
      sessionEpoch: { increment: 1 },
    },
    select: { sessionEpoch: true },
  });
  // Keep THIS browser signed in with the new epoch; every other outstanding
  // token (e.g. a stolen cookie) is now invalidated.
  await createSession(
    {
      userId: session.userId,
      orgId: session.orgId,
      role: session.role,
      email: session.email,
      engineer: session.engineer,
    },
    updated.sessionEpoch,
  );
  redirect("/app/account?success=1");
}

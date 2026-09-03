"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndCount, clear, clientIp } from "@/lib/rate-limit";

export async function login(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Throttle credential stuffing before the bcrypt compare. Keyed by IP and by email.
  const now = Date.now();
  const ip = await clientIp();
  for (const key of [`login-ip:${ip}`, `login-user:${email}`]) {
    if (email && !checkAndCount(key, now).ok) redirect("/login?error=locked");
  }

  const user = email
    ? await prisma.user.findUnique({
        where: { email },
        include: { memberships: { orderBy: { orgId: "asc" } } },
      })
    : null;

  const ok =
    user?.passwordHash != null &&
    user.memberships.length > 0 &&
    (await bcrypt.compare(password, user.passwordHash));
  if (!ok || !user) redirect("/login?error=1");

  clear(`login-ip:${ip}`);
  clear(`login-user:${email}`);

  const membership = user.memberships[0];
  await createSession(
    {
      userId: user.id,
      orgId: membership.orgId,
      role: membership.role,
      email: user.email,
      engineer: user.isEngineer,
    },
    user.sessionEpoch,
  );
  redirect("/app");
}


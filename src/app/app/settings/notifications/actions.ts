"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Per-user (not per-org) preferences: which events reach the user's devices. Any signed-in
// member may set their own — there is nothing here that touches another user or the org.
export async function saveNotificationPrefs(form: FormData): Promise<void> {
  const session = await requireSession();
  const data = {
    calls: form.get("calls") === "on",
    bookings: form.get("bookings") === "on",
    pendingConfirmations: form.get("pendingConfirmations") === "on",
  };
  await prisma.notificationPref.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, ...data },
    update: data,
  });
  revalidatePath("/app/settings/notifications");
  redirect("/app/settings/notifications?saved=1");
}

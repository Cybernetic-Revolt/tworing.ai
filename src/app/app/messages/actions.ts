"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendSmsToCustomer } from "@/lib/sms";

// Owner/admin replies to a customer SMS thread from the portal.
export async function sendReply(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") return;

  const threadId = String(formData.get("threadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId || !body) return;

  const thread = await prisma.smsThread.findFirst({
    where: { id: threadId, orgId: session.orgId },
  });
  if (!thread) return;
  // Defense in depth: don't text an opted-out customer even if the form leaks.
  if (thread.consentState === "OPTED_OUT") return;

  await sendSmsToCustomer({
    orgId: session.orgId,
    toE164: thread.customerPhone,
    body,
    template: "manual-reply",
  });

  revalidatePath(`/app/messages/${threadId}`);
  revalidatePath("/app/messages");
}

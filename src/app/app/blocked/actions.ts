"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// MEMBER (incl. demo) is read-only; blocking needs OWNER/ADMIN.
async function requireEditor() {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/account");
  }
  return session;
}

function toE164(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) return digits.length >= 8 ? digits : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 ? `+${digits}` : null;
}

export async function blockNumber(form: FormData): Promise<void> {
  const session = await requireEditor();
  const e164 = toE164(String(form.get("e164") ?? ""));
  const reason = String(form.get("reason") ?? "").trim() || null;
  const back = String(form.get("returnTo") ?? "/app/account");
  if (!e164) redirect(`${back}?error=number`);

  await prisma.blockedNumber.upsert({
    where: { orgId_e164: { orgId: session.orgId, e164 } },
    create: { orgId: session.orgId, e164, reason },
    update: { reason },
  });
  revalidatePath("/app/account");
  redirect(`${back}?blocked=1`);
}

export async function unblockNumber(form: FormData): Promise<void> {
  const session = await requireEditor();
  const id = String(form.get("id") ?? "");
  if (id) {
    await prisma.blockedNumber.deleteMany({
      where: { id, orgId: session.orgId },
    });
  }
  revalidatePath("/app/account");
  redirect("/app/account");
}

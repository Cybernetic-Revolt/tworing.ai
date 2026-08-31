"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Acting on what the assistant captured.
 *
 * Notes are a record and are only ever deleted. Tasks and reminders are work, so they can
 * be completed or dropped — and completing is not deleting: what was asked for is part of
 * the record even once it is done.
 */

// MEMBER (including the demo login) is read-only, matching every other write in the portal.
async function requireEditor() {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/captured");
  }
  return session;
}

export async function setTaskStatus(form: FormData): Promise<void> {
  const session = await requireEditor();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  // Whitelisted rather than cast: `status` arrives from a form and Prisma would happily
  // accept any string the enum admits, including one this UI never offers.
  if (!id || !["OPEN", "DONE", "CANCELLED"].includes(status)) {
    redirect("/app/captured?error=1");
  }

  // Scoped by orgId in the WHERE clause: updateMany with a tenant predicate cannot touch
  // another org's row even if the id is guessed.
  await prisma.task.updateMany({
    where: { id, orgId: session.orgId },
    data: { status: status as "OPEN" | "DONE" | "CANCELLED" },
  });
  revalidatePath("/app/captured");
  redirect("/app/captured");
}

export async function deleteNote(form: FormData): Promise<void> {
  const session = await requireEditor();
  const id = String(form.get("id") ?? "");
  if (id) {
    await prisma.note.deleteMany({ where: { id, orgId: session.orgId } });
  }
  revalidatePath("/app/captured");
  redirect("/app/captured");
}

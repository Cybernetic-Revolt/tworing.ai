"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Deleting a call record.
 *
 * Vapi let an owner delete a call, so the replacement has to. It is also the only remedy
 * available when a recording captures something it should not have — a caller reciting a
 * card number, a wrong number that turned into a personal conversation. Under PIPEDA the
 * ability to dispose of personal information on request is not a nicety.
 */

// MEMBER (including the demo login) is read-only. Deleting a customer's own call record is
// destructive and irreversible, so it needs OWNER or ADMIN — the same bar as blocking a
// number, which is far less consequential.
async function requireEditor() {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/calls");
  }
  return session;
}

export async function deleteCall(form: FormData): Promise<void> {
  const session = await requireEditor();
  const id = String(form.get("id") ?? "");
  if (!id) redirect("/app/calls?error=missing");

  // Scoped to the session's org in the WHERE clause rather than checked after loading.
  // A findUnique-then-compare leaves a window where a wrong id reveals another tenant's
  // call exists at all, and this is a delete — the wrong row is not recoverable.
  const call = await prisma.call.findFirst({
    where: { id, orgId: session.orgId },
    select: { id: true, recordingUrl: true },
  });
  if (!call) redirect("/app/calls?error=notfound");

  await prisma.$transaction(async (tx) => {
    // Appointments outlive the call that created them. A booked job is a commitment to a
    // customer; deleting the call record must not cancel the work. Detach rather than
    // cascade — the FK is nullable precisely so this is possible.
    await tx.appointment.updateMany({
      where: { callId: call.id, orgId: session.orgId },
      data: { callId: null },
    });
    // Same for the lead: the call is one touchpoint, the lead is the person.
    await tx.call.delete({ where: { id: call.id } });
  });

  // The audio is deliberately NOT deleted here, and this is not an oversight: recordings
  // live in S3 behind a lifecycle rule and nothing in this app can currently reach them.
  // Removing the row while leaving the object would quietly orphan it past its retention,
  // so this is recorded as a known gap rather than pretended away.
  if (call.recordingUrl) {
    console.warn(
      "call %s deleted with a recording still in storage: %s",
      call.id,
      call.recordingUrl,
    );
  }

  revalidatePath("/app/calls");
  redirect("/app/calls?deleted=1");
}

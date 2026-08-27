"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const RECORDINGS_BUCKET = process.env.RECORDINGS_BUCKET ?? "";

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

  // Delete the audio too. The row going while the object stays would leave a recording
  // nobody can reach and nobody can delete, sitting out its 180 days — the opposite of what
  // someone asking to delete a call is asking for.
  //
  // Deliberately after the row is gone: if this fails, the lifecycle rule still expires the
  // object, whereas a failure here blocking the delete would mean a customer cannot remove
  // a call because a bucket was briefly unreachable.
  const name = call.recordingUrl?.split("/").pop();
  if (name && RECORDINGS_BUCKET && /^[A-Za-z0-9._-]{1,200}\.wav$/.test(name)) {
    try {
      const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await new S3Client({}).send(
        new DeleteObjectCommand({
          Bucket: RECORDINGS_BUCKET,
          Key: `recordings/${name}`,
        }),
      );
    } catch (err) {
      console.error("call %s deleted but its recording remains: %s", call.id, err);
    }
  }

  revalidatePath("/app/calls");
  redirect("/app/calls?deleted=1");
}

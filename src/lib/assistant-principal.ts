/**
 * Is the caller the person this assistant works for?
 *
 * Ada's prompt tells her never to disclose the principal's schedule or whereabouts. That is
 * an instruction to a language model, and a language model can be talked out of an
 * instruction. The calendar tools read and write a real personal calendar, so whether they
 * run is decided here instead — in code, before the model's output matters.
 *
 * ⚠️ What this is NOT: authentication. Caller ID is trivially spoofable, so a determined
 * attacker who knows the principal's number can present it. This raises the floor from
 * "ask nicely and the model may tell you" to "spoof a specific unlisted number", which is a
 * real improvement and not a security boundary. Anything that genuinely must not leak needs
 * a spoken PIN or an out-of-band channel.
 */
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

/** Spoken when a non-principal reaches a principal-only tool. Reveals nothing. */
export const NOT_PRINCIPAL =
  "I can't help with that one, but I can take a message and make sure it gets passed on.";

export async function isPrincipal(orgId: string, callerNumber: string | undefined): Promise<boolean> {
  const e164 = normalizePhone(callerNumber);
  // No caller ID at all is treated as not-principal. A withheld number is exactly the case
  // where guessing generously would be worst.
  if (!e164) return false;

  const match = await prisma.assistantContact.findFirst({
    where: { e164, relation: "PRINCIPAL", assistant: { orgId } },
    select: { id: true },
  });
  return match !== null;
}

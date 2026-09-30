"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";

function toE164(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d.length >= 8 ? d : null;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
}

/**
 * Load spare DIDs into the pool.
 *
 * Accepts a paste of several numbers because that is how they arrive — bought in a batch at
 * VoIP.ms and copied out of the console. Numbers already present are skipped rather than
 * rejected, so re-pasting the same list is harmless.
 */
export async function addPoolNumbers(form: FormData): Promise<void> {
  await requireEngineer();
  const raw = String(form.get("numbers") ?? "");
  const sipSubaccount = String(form.get("sipSubaccount") ?? "").trim() || null;
  const note = String(form.get("note") ?? "").trim() || null;

  const e164s = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map(toE164)
        .filter((v): v is string => v !== null),
    ),
  ];
  if (e164s.length === 0) redirect("/admin/numbers?error=parse");

  await prisma.numberPool.createMany({
    data: e164s.map((e164) => ({ e164, sipSubaccount, note })),
    skipDuplicates: true,
  });
  revalidatePath("/admin/numbers");
  redirect(`/admin/numbers?added=${e164s.length}`);
}

/** Remove an unclaimed number from the pool. A claimed one is in use and is left alone. */
export async function removePoolNumber(form: FormData): Promise<void> {
  await requireEngineer();
  const id = String(form.get("id") ?? "");
  if (id) await prisma.numberPool.deleteMany({ where: { id, claimedByOrgId: null } });
  revalidatePath("/admin/numbers");
  redirect("/admin/numbers");
}

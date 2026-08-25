"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function revokeIngestKey(form: FormData): Promise<void> {
  const session = await requireEngineer();
  const id = String(form.get("id") ?? "");
  if (id) {
    await prisma.ingestKey.deleteMany({
      where: { id, orgId: session.orgId },
    });
  }
  revalidatePath("/app/engineering");
  redirect("/app/engineering");
}

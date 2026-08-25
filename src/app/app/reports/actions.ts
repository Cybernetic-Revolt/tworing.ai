"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function setAverageJobValue(form: FormData): Promise<void> {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/reports");
  }
  const raw = String(form.get("averageJobValue") ?? "").replace(/[^\d]/g, "");
  const value = raw ? Math.min(Number(raw), 1_000_000) : null;
  await prisma.org.update({
    where: { id: session.orgId },
    data: { averageJobValue: value },
  });
  revalidatePath("/app/reports");
  redirect("/app/reports");
}

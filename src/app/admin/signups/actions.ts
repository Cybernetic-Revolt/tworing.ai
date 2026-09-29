"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Trial requests from /start.
 *
 * The row is written before the notification email is attempted, so a Resend outage costs
 * the alert and never the lead. That only helps if the rows are visible somewhere, which
 * is what this page is for — until it existed, a failed email meant a prospect sat in the
 * database with nobody aware of them.
 */
export async function setSignupHandled(form: FormData): Promise<void> {
  await requireEngineer();
  const id = String(form.get("id") ?? "");
  const handled = form.get("handled") === "1";
  if (id) {
    await prisma.signup.updateMany({ where: { id }, data: { handled } });
  }
  revalidatePath("/admin/signups");
  redirect("/admin/signups");
}

export async function deleteSignup(form: FormData): Promise<void> {
  await requireEngineer();
  const id = String(form.get("id") ?? "");
  if (id) {
    await prisma.signup.deleteMany({ where: { id } });
  }
  revalidatePath("/admin/signups");
  redirect("/admin/signups?deleted=1");
}

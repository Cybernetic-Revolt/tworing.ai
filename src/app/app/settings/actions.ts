"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function s(v: FormDataEntryValue | null, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function updateSettings(form: FormData): Promise<void> {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/settings");
  }

  const name = s(form.get("name"));
  const timezone = s(form.get("timezone"), 60) || "America/Edmonton";
  const notifyEmail = s(form.get("notifyEmail"), 160).toLowerCase();
  const transferRaw = s(form.get("transferNumber"), 40);
  const avgRaw = s(form.get("averageJobValue"), 12);
  const reviewUrl = s(form.get("googleReviewUrl"), 300);
  const reviewRequests = form.get("reviewRequests") === "on";

  if (!name) redirect("/app/settings?error=name");
  if (notifyEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(notifyEmail)) {
    redirect("/app/settings?error=email");
  }
  if (reviewUrl && !/^https:\/\//.test(reviewUrl)) {
    redirect("/app/settings?error=url");
  }

  // Normalize the human-transfer number to E.164-ish (or clear it).
  let transferNumber: string | null = null;
  if (transferRaw) {
    const digits = transferRaw.replace(/[^\d+]/g, "");
    transferNumber = digits.startsWith("+")
      ? digits
      : digits.length === 10
        ? `+1${digits}`
        : `+${digits}`;
  }

  let averageJobValue: number | null = null;
  if (avgRaw) {
    const n = parseInt(avgRaw.replace(/[^\d]/g, ""), 10);
    if (!Number.isNaN(n) && n > 0) averageJobValue = n;
  }

  // Org-scoped by construction — only the caller's own org is ever touched.
  await prisma.org.update({
    where: { id: session.orgId },
    data: {
      name,
      timezone,
      notifyEmail: notifyEmail || null,
      transferNumber,
      averageJobValue,
      googleReviewUrl: reviewUrl || null,
      reviewRequests,
    },
  });
  revalidatePath("/app/settings");
  redirect("/app/settings?saved=1");
}

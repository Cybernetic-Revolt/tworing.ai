"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertPublicHttpsUrl } from "@/lib/ssrf";

async function requireEditor() {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/connections");
  }
  return session;
}

function s(v: FormDataEntryValue | null): string | undefined {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? undefined : t;
}

export async function saveWebhook(form: FormData): Promise<void> {
  const session = await requireEditor();
  const url = s(form.get("url"));
  if (!url) redirect("/app/connections?error=url");
  // SSRF guard: only allow a public https destination (blocks LAN/loopback/
  // metadata, http, and names that resolve to a private address).
  let urlSafe = false;
  try {
    await assertPublicHttpsUrl(url);
    urlSafe = true;
  } catch {
    /* fall through */
  }
  if (!urlSafe) redirect("/app/connections?error=url");
  const existing = await prisma.orgWebhook.findUnique({
    where: { orgId: session.orgId },
  });
  await prisma.orgWebhook.upsert({
    where: { orgId: session.orgId },
    create: {
      orgId: session.orgId,
      url: url!,
      secret: `whsec_${randomBytes(24).toString("base64url")}`,
      enabled: true,
    },
    update: { url: url!, enabled: form.get("enabled") === "on" || !existing },
  });
  revalidatePath("/app/connections");
  redirect("/app/connections?saved=1");
}

export async function deleteWebhook(): Promise<void> {
  const session = await requireEditor();
  await prisma.orgWebhook.deleteMany({ where: { orgId: session.orgId } });
  revalidatePath("/app/connections");
  redirect("/app/connections");
}

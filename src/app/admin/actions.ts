"use server";

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCheckoutSession, stripeConfigured } from "@/lib/stripe";

const TIERS = ["ANSWER", "OFFICE", "OPERATIONS", "CUSTOM"] as const;
const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;

function pick<T extends readonly string[]>(
  allowed: T,
  value: string,
  fallback: T[number],
): T[number] {
  return (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

export async function createOrg(formData: FormData): Promise<void> {
  await requireEngineer();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const tier = pick(TIERS, String(formData.get("tier") ?? ""), "ANSWER");
  const notifyEmail =
    String(formData.get("notifyEmail") ?? "")
      .trim()
      .toLowerCase() || null;
  if (!name || !slug) redirect("/admin?error=missing");

  const org = await prisma.org
    .create({ data: { name, slug, tier, notifyEmail } })
    .catch(() => null);
  if (!org) redirect("/admin?error=slug");
  redirect(`/admin/orgs/${org.id}`);
}

export async function updateOrg(formData: FormData): Promise<void> {
  await requireEngineer();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const tier = pick(TIERS, String(formData.get("tier") ?? ""), "ANSWER");
  const timezone =
    String(formData.get("timezone") ?? "").trim() || "America/Edmonton";
  const notifyEmail =
    String(formData.get("notifyEmail") ?? "")
      .trim()
      .toLowerCase() || null;
  if (!name) redirect(`/admin/orgs/${id}?error=missing`);

  await prisma.org.update({
    where: { id },
    data: { name, tier, timezone, notifyEmail },
  });
  redirect(`/admin/orgs/${id}?saved=1`);
}

export async function addMember(formData: FormData): Promise<void> {
  await requireEngineer();
  const orgId = String(formData.get("orgId") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");
  const role = pick(ROLES, String(formData.get("role") ?? ""), "MEMBER");
  if (!email) redirect(`/admin/orgs/${orgId}?error=missing`);
  if (password && password.length < 10)
    redirect(`/admin/orgs/${orgId}?error=weak`);

  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      ...(name ? { name } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: { email, name, passwordHash },
  });
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId } },
    update: { role },
    create: { userId: user.id, orgId, role },
  });
  // A role/credential change must invalidate the user's outstanding sessions so
  // it takes effect immediately (getSession re-checks sessionEpoch each request).
  await prisma.user.update({
    where: { id: user.id },
    data: { sessionEpoch: { increment: 1 } },
  });
  redirect(`/admin/orgs/${orgId}?saved=1`);
}

export async function addNumber(formData: FormData): Promise<void> {
  await requireEngineer();
  const orgId = String(formData.get("orgId") ?? "");
  const digits = String(formData.get("e164") ?? "").replace(/[^\d+]/g, "");
  const e164 = digits.startsWith("+")
    ? digits
    : digits.length === 10
      ? `+1${digits}`
      : `+${digits}`;
  const label = String(formData.get("label") ?? "").trim() || null;
  const provider = String(formData.get("provider") ?? "").trim() || "voipms";
  const assistantId = String(formData.get("assistantId") ?? "").trim() || null;
  if (e164.length < 8) redirect(`/admin/orgs/${orgId}?error=number`);
  if (assistantId && !(await assistantInOrg(orgId, assistantId)))
    redirect(`/admin/orgs/${orgId}?error=number`);

  const created = await prisma.phoneNumber
    .create({ data: { orgId, e164, label, provider, assistantId } })
    .catch(() => null);
  if (!created) redirect(`/admin/orgs/${orgId}?error=number`);
  redirect(`/admin/orgs/${orgId}?saved=1`);
}

// An assistant id is only ever accepted when it belongs to this org. The engine resolves a
// number's assistant by DID (not by the submitting form), so a cross-org bind would make one
// client's callers reach another client's assistant — the exact wrong-tenant failure this
// platform guards against everywhere else.
async function assistantInOrg(orgId: string, assistantId: string): Promise<boolean> {
  const a = await prisma.assistant.findUnique({
    where: { id: assistantId },
    select: { orgId: true },
  });
  return a?.orgId === orgId;
}

export async function setNumberAssistant(formData: FormData): Promise<void> {
  await requireEngineer();
  const orgId = String(formData.get("orgId") ?? "");
  const numberId = String(formData.get("numberId") ?? "");
  const assistantId = String(formData.get("assistantId") ?? "").trim() || null;
  if (!numberId) redirect(`/admin/orgs/${orgId}?error=number`);

  // The number must belong to this org, and the assistant (when set) too. Neither is taken
  // on trust from the form.
  const number = await prisma.phoneNumber.findUnique({
    where: { id: numberId },
    select: { orgId: true },
  });
  if (!number || number.orgId !== orgId) redirect(`/admin/orgs/${orgId}?error=number`);
  if (assistantId && !(await assistantInOrg(orgId, assistantId)))
    redirect(`/admin/orgs/${orgId}?error=number`);

  await prisma.phoneNumber.update({
    where: { id: numberId },
    data: { assistantId },
  });
  redirect(`/admin/orgs/${orgId}?saved=1`);
}

export type CheckoutLinkState = { url?: string; error?: string } | null;

export async function createCheckoutLink(
  _prev: CheckoutLinkState,
  formData: FormData,
): Promise<CheckoutLinkState> {
  await requireEngineer();
  if (!stripeConfigured()) return { error: "Stripe is not configured." };
  const orgId = String(formData.get("orgId") ?? "");
  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) return { error: "Org not found." };
  if (org.tier === "CUSTOM") {
    return { error: "Custom tier is invoiced manually — no self-serve price." };
  }
  try {
    const url = await createCheckoutSession({
      tier: org.tier,
      orgId: org.id,
      customerEmail: org.notifyEmail ?? undefined,
    });
    return { url };
  } catch (err) {
    return { error: String(err).slice(0, 200) };
  }
}

export type IssueKeyState = { rawKey?: string; error?: string } | null;

export async function issueIngestKey(
  _prev: IssueKeyState,
  formData: FormData,
): Promise<IssueKeyState> {
  await requireEngineer();
  const orgId = String(formData.get("orgId") ?? "");
  const label = String(formData.get("label") ?? "").trim() || "key";

  // Same format the provision script uses; only the SHA-256 hash is stored.
  const rawKey = `blk_${randomBytes(24).toString("base64url")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const created = await prisma.ingestKey
    .create({ data: { orgId, keyHash, label } })
    .catch(() => null);
  if (!created) return { error: "Could not create the key." };
  return { rawKey };
}

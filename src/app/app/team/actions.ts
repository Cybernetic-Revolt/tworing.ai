"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession, type Session } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
type Role = (typeof ROLES)[number];

async function requireEditor(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/app");
  return session;
}

function toRole(v: FormDataEntryValue | null): Role {
  const x = String(v ?? "");
  return (ROLES as readonly string[]).includes(x) ? (x as Role) : "MEMBER";
}

function back(q: string): never {
  redirect(`/app/team?${q}`);
}

async function ownerCount(orgId: string): Promise<number> {
  return prisma.membership.count({ where: { orgId, role: "OWNER" } });
}

// Bump the affected user's sessionEpoch so a role change / removal revokes any
// session they already hold (see src/lib/auth.ts).
async function revoke(userId: string): Promise<void> {
  await prisma.user
    .update({ where: { id: userId }, data: { sessionEpoch: { increment: 1 } } })
    .catch(() => {});
}

export async function inviteMember(form: FormData): Promise<void> {
  const session = await requireEditor();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim() || null;
  const password = String(form.get("password") ?? "");
  const role = toRole(form.get("role"));

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("error=email");
  // Only an OWNER may grant OWNER.
  if (role === "OWNER" && session.role !== "OWNER") back("error=perm");

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { orgId: session.orgId } } },
  });
  if (existing && existing.memberships.length > 0) back("error=exists");
  // A brand-new user needs a working password so they can sign in.
  if (!existing && password.length < 10) back("error=weak");

  const user =
    existing ??
    (await prisma.user.create({
      data: { email, name, passwordHash: await bcrypt.hash(password, 12) },
    }));
  await prisma.membership.create({
    data: { userId: user.id, orgId: session.orgId, role },
  });
  revalidatePath("/app/team");
  back("invited=1");
}

export async function changeRole(form: FormData): Promise<void> {
  const session = await requireEditor();
  const membershipId = String(form.get("membershipId") ?? "");
  const role = toRole(form.get("role"));

  const m = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: session.orgId },
  });
  if (!m) back("error=notfound");
  if (m.userId === session.userId) back("error=self"); // no self role-changes
  // Only an OWNER may touch an OWNER, or grant OWNER.
  if ((m.role === "OWNER" || role === "OWNER") && session.role !== "OWNER") {
    back("error=perm");
  }
  // Never demote the last remaining OWNER.
  if (m.role === "OWNER" && role !== "OWNER" && (await ownerCount(session.orgId)) <= 1) {
    back("error=lastowner");
  }
  if (m.role !== role) {
    await prisma.membership.update({ where: { id: m.id }, data: { role } });
    await revoke(m.userId);
  }
  revalidatePath("/app/team");
  back("saved=1");
}

export async function removeMember(form: FormData): Promise<void> {
  const session = await requireEditor();
  const membershipId = String(form.get("membershipId") ?? "");

  const m = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: session.orgId },
  });
  if (!m) back("error=notfound");
  if (m.userId === session.userId) back("error=self"); // can't remove yourself
  if (m.role === "OWNER" && session.role !== "OWNER") back("error=perm");
  if (m.role === "OWNER" && (await ownerCount(session.orgId)) <= 1) {
    back("error=lastowner");
  }
  await prisma.membership.delete({ where: { id: m.id } });
  await revoke(m.userId);
  revalidatePath("/app/team");
  back("removed=1");
}

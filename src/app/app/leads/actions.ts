"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeadStatus } from "@/generated/prisma/client";

const STATUSES = [
  "NEW",
  "CONTACTED",
  "QUOTED",
  "BOOKED",
  "DONE",
  "LOST",
] as const;

// MEMBER (incl. demo sessions) is read-only; pipeline changes need OWNER/ADMIN.
async function requireEditor() {
  const session = await requireSession();
  if (session.role !== "OWNER" && session.role !== "ADMIN") {
    redirect("/app/leads");
  }
  return session;
}

function s(v: FormDataEntryValue | null): string | undefined {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? undefined : t;
}

export async function setLeadStatus(form: FormData): Promise<void> {
  const session = await requireEditor();
  const id = s(form.get("id"));
  const status = s(form.get("status"));
  if (!id || !status || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect("/app/leads");
  }

  const lead = await prisma.lead.findFirst({
    where: { id, orgId: session.orgId },
  });
  if (!lead) redirect("/app/leads");
  if (lead.status === status) redirect(`/app/leads/${id}`);

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: { status: status as LeadStatus },
    }),
    prisma.leadActivity.create({
      data: {
        orgId: session.orgId,
        leadId: lead.id,
        actor: "USER",
        kind: "STATUS_CHANGE",
        payload: { from: lead.status, to: status },
      },
    }),
  ]);
  revalidatePath("/app/leads");
  redirect(`/app/leads/${id}`);
}

export async function addLeadNote(form: FormData): Promise<void> {
  const session = await requireEditor();
  const id = s(form.get("id"));
  const text = s(form.get("text"));
  if (!id) redirect("/app/leads");
  if (!text) redirect(`/app/leads/${id}`);

  const lead = await prisma.lead.findFirst({
    where: { id, orgId: session.orgId },
  });
  if (!lead) redirect("/app/leads");

  await prisma.leadActivity.create({
    data: {
      orgId: session.orgId,
      leadId: lead.id,
      actor: "USER",
      kind: "NOTE",
      payload: { text },
    },
  });
  revalidatePath(`/app/leads/${id}`);
  redirect(`/app/leads/${id}`);
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toCsv } from "@/lib/csv";

// Self-serve data export (spec §4.10): the client's data is theirs, and this
// is also how a PIPEDA access request gets answered. Read-only, org-scoped —
// available to any signed-in session including read-only demo viewers.

type ExportType = "calls" | "leads" | "appointments";

const COLUMNS: Record<ExportType, { key: string; header: string }[]> = {
  calls: [
    { key: "startedAt", header: "started_at" },
    { key: "callerName", header: "caller_name" },
    { key: "callerNumber", header: "caller_number" },
    { key: "durationSec", header: "duration_sec" },
    { key: "endedReason", header: "ended_reason" },
    { key: "summary", header: "summary" },
    { key: "transcript", header: "transcript" },
    { key: "recordingUrl", header: "recording_url" },
  ],
  leads: [
    { key: "createdAt", header: "created_at" },
    { key: "name", header: "name" },
    { key: "phone", header: "phone" },
    { key: "email", header: "email" },
    { key: "jobType", header: "job_type" },
    { key: "address", header: "address" },
    { key: "urgency", header: "urgency" },
    { key: "status", header: "status" },
    { key: "notes", header: "notes" },
  ],
  appointments: [
    { key: "startsAt", header: "starts_at" },
    { key: "endsAt", header: "ends_at" },
    { key: "customerName", header: "customer_name" },
    { key: "customerPhone", header: "customer_phone" },
    { key: "jobType", header: "job_type" },
    { key: "address", header: "address" },
    { key: "status", header: "status" },
    { key: "source", header: "source" },
    { key: "notes", header: "notes" },
  ],
};

async function rowsFor(orgId: string, type: ExportType) {
  if (type === "calls") {
    return prisma.call.findMany({
      where: { orgId },
      orderBy: { startedAt: "desc" },
      select: {
        startedAt: true,
        callerName: true,
        callerNumber: true,
        durationSec: true,
        endedReason: true,
        summary: true,
        transcript: true,
        recordingUrl: true,
      },
    });
  }
  if (type === "leads") {
    return prisma.lead.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        name: true,
        phone: true,
        email: true,
        jobType: true,
        address: true,
        urgency: true,
        status: true,
        notes: true,
      },
    });
  }
  return prisma.appointment.findMany({
    where: { orgId },
    orderBy: { startsAt: "desc" },
    select: {
      startsAt: true,
      endsAt: true,
      customerName: true,
      customerPhone: true,
      jobType: true,
      address: true,
      status: true,
      source: true,
      notes: true,
    },
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type") as ExportType | null;
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  if (!type || !(type in COLUMNS)) {
    return NextResponse.json({ error: "unknown export type" }, { status: 400 });
  }

  const rows = (await rowsFor(session.orgId, type)) as Record<string, unknown>[];
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `tworing-${type}-${stamp}.${format}`;

  const body =
    format === "json"
      ? JSON.stringify(rows, null, 2)
      : toCsv(COLUMNS[type], rows);

  return new Response(body, {
    headers: {
      "Content-Type":
        format === "json"
          ? "application/json; charset=utf-8"
          : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

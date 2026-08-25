import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public uptime probe (spec §12.2). Checks the database round-trip; used by
// Uptime Kuma, the status page, and the nightly canary. No tenant data.
export async function GET(): Promise<NextResponse> {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", db: "up", latencyMs: Date.now() - startedAt },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

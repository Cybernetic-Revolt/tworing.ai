import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

// Per-tenant webhook/tool auth: Vapi presents the org's raw key as
// X-Vapi-Secret (or n8n forwards it as X-Bilco-Ingest-Key); we look up its
// SHA-256 hash. Returns the IngestKey row with org, or null.
export async function resolveTenantKey(req: Request) {
  const rawKey =
    req.headers.get("x-bilco-ingest-key") ?? req.headers.get("x-vapi-secret");
  if (!rawKey) return null;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  return prisma.ingestKey.findUnique({
    where: { keyHash },
    include: { org: true },
  });
}

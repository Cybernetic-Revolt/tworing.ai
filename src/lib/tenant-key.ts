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

export type ResolvedKey = NonNullable<Awaited<ReturnType<typeof resolveTenantKey>>>;

export type CallOrg =
  | { ok: true; orgId: string; org: ResolvedKey["org"] }
  | { ok: false; status: number; error: string };

/**
 * Which org does this call belong to?
 *
 * Two different questions get answered by two different facts, and conflating them is the
 * bug this exists to prevent:
 *
 * - A TENANT key *is* the org. Vapi holds one key per client, so the key answers it.
 * - An ENGINE key is not an org at all. The voice engine answers for every client, so the
 *   org follows from **which number rang** — looked up here, server-side. The engine cannot
 *   name an org, and neither can the language model driving the call: both only influence
 *   which DID was dialled, and that is a fact about the phone network, not a claim in a
 *   payload.
 *
 * A TENANT key that presents a dialled number belonging to someone else is refused rather
 * than silently ignored — that combination means a misconfiguration, and guessing which
 * half was right is how data ends up in the wrong account.
 */
export async function resolveCallOrg(
  key: ResolvedKey,
  dialledE164: string | null | undefined,
): Promise<CallOrg> {
  if (key.scope === "ENGINE") {
    if (!dialledE164) {
      return {
        ok: false,
        status: 400,
        error:
          "engine key requires the dialled number; without it the tenant cannot be determined",
      };
    }
    const number = await prisma.phoneNumber.findUnique({
      where: { e164: dialledE164 },
      include: { org: true },
    });
    if (!number) {
      return { ok: false, status: 404, error: "no org owns that number" };
    }
    return { ok: true, orgId: number.orgId, org: number.org };
  }

  if (dialledE164) {
    const number = await prisma.phoneNumber.findUnique({ where: { e164: dialledE164 } });
    if (number && number.orgId !== key.orgId) {
      return { ok: false, status: 403, error: "that number belongs to another org" };
    }
  }
  return { ok: true, orgId: key.orgId, org: key.org };
}

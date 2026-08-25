// Generic outbound webhook delivery. Signs the payload with the org's secret
// (HMAC-SHA256, sent as x-tworing-signature) so the receiver can verify it.
// Fire-and-forget from booking/lead paths — never blocks or fails the action.
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import { assertPublicHttpsUrl } from "@/lib/ssrf";

type WebhookEvent = "lead.created" | "lead.updated" | "appointment.created";

export async function fireWebhook(
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const hook = await prisma.orgWebhook.findUnique({ where: { orgId } });
  if (!hook || !hook.enabled) return;

  // SSRF guard: never fetch a private/internal destination, even if one was
  // somehow stored. Records the block so the owner sees why nothing fired.
  try {
    await assertPublicHttpsUrl(hook.url);
  } catch {
    await prisma.orgWebhook
      .update({
        where: { orgId },
        data: {
          lastFiredAt: new Date(),
          lastError: "blocked: destination must be a public https URL",
        },
      })
      .catch(() => {});
    return;
  }

  const body = JSON.stringify({
    event,
    orgId,
    sentAt: new Date().toISOString(),
    data,
  });
  const signature = createHmac("sha256", hook.secret).update(body).digest("hex");

  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tworing-event": event,
        "x-tworing-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    await prisma.orgWebhook.update({
      where: { orgId },
      data: {
        lastStatus: res.status,
        lastFiredAt: new Date(),
        lastError: res.ok ? null : `HTTP ${res.status}`,
      },
    });
  } catch (err) {
    await prisma.orgWebhook
      .update({
        where: { orgId },
        data: { lastFiredAt: new Date(), lastError: String(err).slice(0, 300) },
      })
      .catch(() => {});
  }
}

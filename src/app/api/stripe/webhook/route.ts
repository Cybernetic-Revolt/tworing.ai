import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tierForPrice, verifyWebhook } from "@/lib/stripe";
import { Tier } from "@/generated/prisma/client";

// Stripe subscription lifecycle → org tier + subscription status.
// Raw body required for signature verification.

type StripeObj = Record<string, unknown>;

function s(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function statusFromStripe(stripeStatus: string | undefined): string {
  switch (stripeStatus) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    case "paused":
      return "PAUSED";
    default:
      return "ACTIVE";
  }
}

async function upsertFromSubscription(sub: StripeObj): Promise<void> {
  const meta = (sub.metadata ?? {}) as StripeObj;
  const orgId = s(meta.orgId);
  if (!orgId) return;
  const customer = s(sub.customer);
  const items = (sub.items ?? {}) as StripeObj;
  const data = (items.data ?? []) as StripeObj[];
  const price = data[0]?.price as StripeObj | undefined;
  const tier = (tierForPrice(s(price?.id)) ?? s(meta.tier) ?? "ANSWER") as Tier;
  const status = statusFromStripe(s(sub.status));
  const periodEnd = sub.current_period_end
    ? new Date(Number(sub.current_period_end) * 1000)
    : null;
  const trialEnd = sub.trial_end ? new Date(Number(sub.trial_end) * 1000) : null;

  await prisma.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      stripeCustomerId: customer ?? `unknown_${orgId}`,
      stripeSubId: s(sub.id),
      status: status as never,
      tier,
      currentPeriodEnd: periodEnd,
      trialEndsAt: trialEnd,
    },
    update: {
      stripeCustomerId: customer ?? undefined,
      stripeSubId: s(sub.id),
      status: status as never,
      tier,
      currentPeriodEnd: periodEnd,
      trialEndsAt: trialEnd,
    },
  });

  // Entitlements: an active/trialing sub sets the org's tier to what they pay
  // for. A cancellation leaves the tier but flags status (UI shows past-due /
  // paused banners; assistant-pause-on-cancel is handled separately).
  if (status === "ACTIVE" || status === "TRIALING") {
    await prisma.org.update({ where: { id: orgId }, data: { tier } });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const sig = req.headers.get("stripe-signature");
  const payload = await req.text();
  if (!sig) {
    return NextResponse.json({ error: "no signature" }, { status: 400 });
  }

  let event: StripeObj;
  try {
    event = verifyWebhook(payload, sig) as StripeObj;
  } catch (err) {
    console.error("stripe webhook verify failed", String(err));
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const type = s(event.type);
  const obj = ((event.data as StripeObj)?.object ?? {}) as StripeObj;

  try {
    switch (type) {
      case "checkout.session.completed": {
        const orgId = s(obj.client_reference_id) ?? s((obj.metadata as StripeObj)?.orgId);
        const customer = s(obj.customer);
        const subId = s(obj.subscription);
        const tier = (s((obj.metadata as StripeObj)?.tier) ?? "ANSWER") as Tier;
        if (orgId && customer) {
          await prisma.subscription.upsert({
            where: { orgId },
            create: {
              orgId,
              stripeCustomerId: customer,
              stripeSubId: subId,
              status: "TRIALING" as never,
              tier,
            },
            update: { stripeCustomerId: customer, stripeSubId: subId, tier },
          });
          await prisma.org.update({ where: { id: orgId }, data: { tier } });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created":
      case "customer.subscription.deleted":
        await upsertFromSubscription(obj);
        break;
      case "invoice.paid":
      case "invoice.payment_failed": {
        const subId = s(obj.subscription);
        if (subId) {
          const status = type === "invoice.paid" ? "ACTIVE" : "PAST_DUE";
          await prisma.subscription.updateMany({
            where: { stripeSubId: subId },
            data: { status: status as never },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("stripe webhook handler error", type, String(err));
    // 200 anyway so Stripe doesn't hammer retries for a non-signature error.
  }

  return NextResponse.json({ received: true });
}

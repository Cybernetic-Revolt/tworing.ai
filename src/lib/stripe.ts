// Minimal Stripe client over the REST API (form-encoded), matching the
// app's no-SDK pattern. Used for Checkout links, the billing portal, and
// webhook signature verification.
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = "https://api.stripe.com/v1";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

function key(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("STRIPE_SECRET_KEY is not set");
  return k;
}

// Flatten nested objects/arrays into Stripe's bracket form-encoding.
function encode(obj: Record<string, unknown>, prefix = ""): string[] {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) {
      parts.push(...encode(v as Record<string, unknown>, name));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object") {
          parts.push(...encode(item as Record<string, unknown>, `${name}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts;
}

async function stripe<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? encode(body).join("&") : undefined,
  });
  if (!res.ok) {
    throw new Error(`Stripe ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

const PRICE_BY_TIER: Record<string, string | undefined> = {
  ANSWER: process.env.STRIPE_PRICE_ANSWER,
  OFFICE: process.env.STRIPE_PRICE_OFFICE,
  OPERATIONS: process.env.STRIPE_PRICE_OPERATIONS,
};

export function priceForTier(tier: string): string | undefined {
  return PRICE_BY_TIER[tier];
}

export function tierForPrice(priceId: string | undefined): string | undefined {
  if (!priceId) return undefined;
  for (const [tier, id] of Object.entries(PRICE_BY_TIER)) {
    if (id && id === priceId) return tier;
  }
  return undefined;
}

// Create (or reuse) a Checkout Session for a 14-day-trial subscription.
export async function createCheckoutSession(opts: {
  tier: string;
  orgId: string;
  customerEmail?: string;
}): Promise<string> {
  const price = priceForTier(opts.tier);
  if (!price) throw new Error(`no Stripe price configured for tier ${opts.tier}`);
  const base = process.env.PLATFORM_URL ?? "https://tworing.ai";
  const session = await stripe<{ url: string }>("/checkout/sessions", {
    mode: "subscription",
    "line_items": [{ price, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { orgId: opts.orgId, tier: opts.tier },
    },
    metadata: { orgId: opts.orgId, tier: opts.tier },
    client_reference_id: opts.orgId,
    ...(opts.customerEmail ? { customer_email: opts.customerEmail } : {}),
    allow_promotion_codes: true,
    success_url: `${base}/admin/orgs/${opts.orgId}?billing=started`,
    cancel_url: `${base}/admin/orgs/${opts.orgId}?billing=cancelled`,
  });
  return session.url;
}

export async function createBillingPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe<{ url: string }>("/billing_portal/sessions", {
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}

// Verify a Stripe webhook signature (t=...,v1=...). Returns the parsed event
// or throws. Tolerance 5 min.
export function verifyWebhook(payload: string, sigHeader: string): unknown {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  // Parse "t=...,v1=...": split each pair on the FIRST '=' only (signature
  // values are hex here, but be robust) and ignore malformed segments.
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const i = kv.indexOf("=");
    if (i === -1) continue;
    parts[kv.slice(0, i).trim()] = kv.slice(i + 1);
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) throw new Error("malformed signature header");
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("signature mismatch");
  }
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) {
    throw new Error("timestamp outside tolerance");
  }
  return JSON.parse(payload);
}

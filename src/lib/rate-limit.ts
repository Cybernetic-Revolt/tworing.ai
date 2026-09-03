import { headers } from "next/headers";

/**
 * A small in-process login throttle.
 *
 * The threat is credential stuffing, and on the staff door it is the sharpest one the product
 * has: a guessed staff password is `engineer: true`, which reads every tenant's recordings.
 * Both login actions were bare bcrypt compares with nothing counting attempts.
 *
 * This is deliberately in-memory, which is the right scope here and worth stating plainly:
 * the platform runs as a single `next start` process, so every login attempt hits this one
 * map — there is no second instance for an attacker to spread across. Its limits are that it
 * resets on deploy/restart (fine: an attacker cannot force a restart, and a restart only ever
 * *clears* a lockout, never grants access) and that it is not shared state (there is none to
 * share). It is defence in depth, not the only layer — a Cloudflare rate-limit rule on the
 * login paths is the durable edge control and should exist alongside it; this guarantees a
 * floor even if that rule is absent or misconfigured.
 *
 * Keyed by IP *and* by account, so one noisy network cannot lock out an unrelated user and one
 * targeted account cannot be hammered from many IPs without each IP also tripping.
 */

type Bucket = { count: number; first: number; lockedUntil: number };

const WINDOW_MS = 15 * 60 * 1000; // attempts are counted over a rolling 15 minutes
//: Per-account: a targeted account is protected tightly.
export const MAX_ATTEMPTS_ACCOUNT = 8;
//: Per-IP: an office or carrier NAT can put many legitimate users behind one address, so the
//: IP ceiling is deliberately high — it exists to blunt broad credential stuffing from a
//: single source, not to lock out a shared network after a handful of typos. The account key
//: is the sharp instrument; this is the blunt backstop.
export const MAX_IP = 50;
const LOCKOUT_MS = 15 * 60 * 1000; // how long a tripped key stays locked

const buckets = new Map<string, Bucket>();

/**
 * Bound the map so a flood of distinct keys (random emails, spoofed IPs) cannot grow it
 * without limit. When it reaches the cap, the oldest entries are dropped — which can only
 * *forgive* attempts early, never extend a lockout, so eviction is safe.
 */
const MAX_KEYS = 10_000;

function evictIfNeeded(now: number): void {
  if (buckets.size < MAX_KEYS) return;
  for (const [k, b] of buckets) {
    if (b.lockedUntil < now && now - b.first > WINDOW_MS) buckets.delete(k);
    if (buckets.size < MAX_KEYS * 0.9) break;
  }
}

/** The caller's IP, from the headers the tunnel/Cloudflare set. `unknown` if none is present. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]!.trim() || "unknown";
}

export type RateVerdict = { ok: true } | { ok: false; retryAfterSec: number };

/**
 * Record and judge a login attempt against a key. Call BEFORE the password check; a key that
 * is already locked short-circuits so a lockout also stops the (relatively expensive) bcrypt
 * compare from running.
 *
 * `now` is a parameter so this is testable without a clock; callers pass `Date.now()`.
 */
export function checkAndCount(key: string, now: number, max: number): RateVerdict {
  evictIfNeeded(now);
  const b = buckets.get(key);

  if (b && b.lockedUntil > now) {
    return { ok: false, retryAfterSec: Math.ceil((b.lockedUntil - now) / 1000) };
  }
  // Fresh key, or the previous window/lockout has fully elapsed → start clean.
  if (!b || now - b.first > WINDOW_MS) {
    buckets.set(key, { count: 1, first: now, lockedUntil: 0 });
    return { ok: true };
  }
  b.count += 1;
  if (b.count > max) {
    b.lockedUntil = now + LOCKOUT_MS;
    return { ok: false, retryAfterSec: Math.ceil(LOCKOUT_MS / 1000) };
  }
  return { ok: true };
}

/**
 * Forget a key's failures. Called after a SUCCESSFUL login so a legitimate user who fat-fingers
 * their password a few times and then gets it right does not carry a near-lockout forward.
 */
export function clear(key: string): void {
  buckets.delete(key);
}

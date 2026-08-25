// SSRF guard for user-supplied outbound URLs (e.g. org webhook targets).
// The platform runs on a private LAN, so an unvalidated fetch() to an
// org-controlled URL could reach internal hosts or cloud metadata. Require
// https, reject private/loopback/link-local literals and names, and — best
// effort — reject hostnames that RESOLVE to a private address.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    if (p.some((n) => Number.isNaN(n))) return true; // treat unparseable as unsafe
    if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local + cloud metadata
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT
    if (p[0] >= 224) return true; // multicast / reserved
    return false;
  }
  const low = ip.toLowerCase();
  if (low === "::1" || low === "::") return true;
  if (low.startsWith("::ffff:")) return isPrivateIp(low.slice(7)); // v4-mapped
  if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA fc00::/7
  if (low.startsWith("fe80")) return true; // link-local
  return false;
}

function hostname(raw: string): string {
  return new URL(raw).hostname.toLowerCase().replace(/^\[|\]$/g, "");
}

const BLOCKED_SUFFIXES = [".local", ".internal", ".lan", ".home", ".localdomain"];

/**
 * Throws if `raw` is not a safe public https URL. Use at save time (reject the
 * input) and again at fire time (defense in depth against a stored bad URL).
 */
export async function assertPublicHttpsUrl(raw: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }
  if (u.protocol !== "https:") throw new Error("must be https");
  const host = hostname(raw);
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    BLOCKED_SUFFIXES.some((s) => host.endsWith(s))
  ) {
    throw new Error("host not allowed");
  }
  if (isIP(host) && isPrivateIp(host)) {
    throw new Error("private address not allowed");
  }
  // Resolve and re-check every returned address (best effort; a name can point
  // at a private IP). DNS-rebinding after this check is out of scope for a
  // fire-and-forget webhook but the save-time + fire-time checks cover the
  // common cases.
  let addrs;
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error("host does not resolve");
  }
  if (addrs.length === 0) throw new Error("host does not resolve");
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new Error("resolves to a private address");
  }
}

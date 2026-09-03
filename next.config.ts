import type { NextConfig } from "next";

// Baseline security headers applied to every response. The CSP is intentionally
// limited to framing/base/object controls so it can't break Next's inline
// runtime scripts/styles; it still blocks clickjacking and base-tag hijacking.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Server Actions run behind a Cloudflare Tunnel whose origin service is
  // http://127.0.0.1:3000. Next's Server-Action CSRF guard compares the request Origin
  // against the Host it sees, and behind a reverse proxy those can differ — the exact case
  // `allowedOrigins` documents ("a reverse proxy in front of your app"). Declaring the real
  // public origins tells the guard they are trusted regardless of the proxied Host. This is
  // hardening for the proxied deployment, not a CSRF loosening: only these exact hosts are
  // listed, and the tunnel already terminates at a single origin we control.
  experimental: {
    serverActions: {
      allowedOrigins: ["tworing.ai", "www.tworing.ai", "admin.tworing.ai", "aws.tworing.ai"],
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

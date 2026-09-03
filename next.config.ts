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
  // http://127.0.0.1:3000, so the Host header Next sees on the action POST does not
  // always match the public Origin (tworing.ai). Next's built-in Server-Action CSRF
  // guard then rejects the action and falls back to re-rendering the page — and that
  // fallback render carries no session cookie, so requireSession() bounces the user to
  // /login. The visible symptom was every settings save logging the user out.
  //
  // Declaring the real public origins here tells the guard those Origins are trusted
  // regardless of the proxied Host, which is exactly what allowedOrigins is for. This is
  // NOT a loosening of CSRF: only these exact hosts are allowed, and the tunnel already
  // terminates at a single origin we control.
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

import type { MetadataRoute } from "next";

// Public marketing pages are crawlable; the authed portal, admin, API, and the
// cookie-setting demo portals are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/admin", "/api", "/demo/"],
      },
    ],
    sitemap: "https://tworing.ai/sitemap.xml",
  };
}

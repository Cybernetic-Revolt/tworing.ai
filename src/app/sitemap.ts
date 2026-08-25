import type { MetadataRoute } from "next";

// Public, indexable marketing routes. The portal/admin/demo-portal routes are
// intentionally excluded (auth-gated or cookie-setting).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://tworing.ai";
  const routes: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/missed-call-calculator", priority: 0.8 },
    { path: "/demo", priority: 0.6 },
    { path: "/security", priority: 0.4 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];
  return routes.map((r) => ({
    url: `${base}${r.path}`,
    changeFrequency: "weekly",
    priority: r.priority,
  }));
}

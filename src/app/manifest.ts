import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Scope is the whole origin (not /app) so the login page
// stays inside the installed window — a scope of /app would bounce a logged-out user out to
// a browser tab and back. start_url carries a marker so installed launches are visible in logs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TwoRing",
    short_name: "TwoRing",
    description: "Your AI receptionist's calls, bookings and leads — on your phone.",
    id: "/app",
    start_url: "/app?source=pwa",
    scope: "/",
    display: "standalone",
    // No orientation lock: the calls table and calendar are wide views, and an Android tablet
    // in landscape should not be refused.
    background_color: "#fafafa",
    theme_color: "#18181b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

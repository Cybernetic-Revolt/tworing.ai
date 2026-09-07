"use client";

import { useEffect } from "react";

// Registers the service worker on every portal page. Registration is silent — it asks for
// nothing and shows nothing. Asking for notification permission happens only from the
// button on Settings → Notifications, in response to a tap.
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // updateViaCache "none": Cloudflare caches .js by extension and rewrites our no-cache
    // header to max-age=14400, so the browser must be told to bypass its HTTP cache when it
    // checks for a new worker — otherwise a push-handler fix could sit unseen for hours.
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((err) => {
      console.warn("service worker registration failed", err);
    });
  }, []);
  return null;
}

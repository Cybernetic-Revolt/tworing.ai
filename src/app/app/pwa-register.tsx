"use client";

import { useEffect } from "react";
import { ensureFreshSubscription } from "@/lib/pwa-client";

// Registers the service worker on every portal page, then keeps an existing push
// subscription healthy: after a VAPID rotation the old one is replaced automatically when
// permission was already granted. Silent — this never prompts and never creates a first
// subscription; that happens only from the button on Settings → Notifications, on a tap.
export function PwaRegister({ publicKey }: { publicKey: string | null }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // updateViaCache "none": Cloudflare caches .js by extension and rewrites our no-cache
    // header to max-age=14400, so the browser must be told to bypass its HTTP cache when it
    // checks for a new worker — otherwise a push-handler fix could sit unseen for hours.
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then(async () => {
        if (!publicKey || !("PushManager" in window) || !("Notification" in window)) return;
        const reg = await navigator.serviceWorker.ready;
        await ensureFreshSubscription(reg, publicKey);
      })
      .catch((err) => {
        console.warn("service worker / push refresh failed", err);
      });
  }, [publicKey]);
  return null;
}

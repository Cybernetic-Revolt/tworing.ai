"use client";

import { useEffect } from "react";

// Registers the service worker on every portal page. Registration is silent — it asks for
// nothing and shows nothing. Asking for notification permission happens only from the
// button on Settings → Notifications, in response to a tap.
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.warn("service worker registration failed", err);
    });
  }, []);
  return null;
}

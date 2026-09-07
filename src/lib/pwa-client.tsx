// Browser-side PWA helpers shared by the install nudge and the notification controls.
// Client-only: every function touches `window`/`navigator` and must be called from an effect
// or a handler, never during server render.

/** iOS's share icon (box with an up-arrow), inline so no font has to carry it. */
export function ShareIcon({ className = "inline h-4 w-4 -mt-0.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

/** True when the portal is running as an installed app (home-screen / dock), not a tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // Safari's pre-standard flag, still the reliable signal on iOS.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone / iPad (including iPadOS presenting as a Mac with touch). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** VAPID public key (base64url) → the Uint8Array `subscribe()` wants. */
export function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

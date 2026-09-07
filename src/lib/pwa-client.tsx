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

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const av = new Uint8Array(a);
  for (let i = 0; i < av.length; i++) if (av[i] !== b[i]) return false;
  return true;
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Tell the server about a subscription. Throws on a non-2xx so callers can show it. */
export async function registerSubscription(sub: PushSubscription): Promise<void> {
  const res = await post("/api/push/subscribe", { subscription: sub.toJSON() });
  if (!res.ok) throw new Error(`server said ${res.status}`);
}

/**
 * The subscription this browser should be using, given the key the server signs with today.
 *
 * - No subscription: returns null (nothing is created here without a tap — see PushControls).
 * - Subscription made with today's key: returned as is. It is NOT re-posted: the server row
 *   was written when it was created, and re-posting on every page load would let whoever is
 *   signed in on a shared browser claim the other person's device just by opening the app.
 * - Subscription made with a PREVIOUS key (a VAPID rotation): it can never deliver again, so
 *   it is dropped on both sides. Then, if the user already granted permission, a fresh one
 *   is created with the new key and registered — no tap needed, and nothing prompts. If
 *   permission is not granted, returns null and the settings page shows "off".
 *
 * Runs on every portal page load (PwaRegister) so a rotation heals itself the next time the
 * owner opens the app, not the next time they happen to visit Settings.
 */
export async function ensureFreshSubscription(
  reg: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription | null> {
  const key = urlBase64ToUint8Array(publicKey);
  const existing = await reg.pushManager.getSubscription();
  if (!existing) return null;
  if (sameKey(existing.options.applicationServerKey, key)) return existing;
  await post("/api/push/unsubscribe", { endpoint: existing.endpoint }).catch(() => {});
  await existing.unsubscribe().catch(() => {});
  if (Notification.permission !== "granted") return null;
  const fresh = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key as BufferSource,
  });
  await registerSubscription(fresh);
  return fresh;
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

/* TwoRing service worker — push only.
 *
 * Deliberately no fetch handler / offline cache: the portal is live data, and a stale cached
 * calls list is worse than a network error. The worker exists so the portal is installable
 * and so a push wakes the phone with a real notification.
 *
 * Every push MUST show a notification. iOS revokes the subscription after a few silent
 * pushes, so even an unparseable payload shows something rather than nothing.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function parsePayload(event) {
  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data.title === "string") return data;
  } catch {
    /* fall through */
  }
  return { title: "TwoRing", body: "You have a new update.", url: "/app", tag: "generic" };
}

self.addEventListener("push", (event) => {
  const p = parsePayload(event);
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: p.tag || undefined,
      // A second push about the same call/booking replaces the first card silently: the
      // call-ended summary updating a "Booked:" card, or a webhook retry, must not buzz twice.
      renotify: false,
      // The owner has to act on a pending booking — keep it on screen until they do.
      requireInteraction: p.kind === "pending",
      data: { url: p.url || "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/app", self.location.origin).href;
  event.waitUntil(
    // Reuse an open portal window (the installed app) rather than spawning a second one —
    // a window this worker CONTROLS first (navigate() works there); only then an
    // uncontrolled one (e.g. a marketing tab opened before the worker installed), where
    // navigate() rejects and we fall back to opening the link fresh.
    self.clients
      .matchAll({ type: "window" })
      .then((controlled) => (controlled.length ? controlled : self.clients.matchAll({ type: "window", includeUncontrolled: true })))
      .then((clients) => {
      for (const c of clients) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          const go = c.navigate ? c.navigate(url).then((w) => (w || c).focus()) : c.focus();
          return Promise.resolve(go).catch(() => self.clients.openWindow(url));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// The browser rotated this device's subscription on its own (push-service maintenance).
// Re-subscribe with the same server key and tell the server, so delivery continues without
// the owner having to revisit Settings. The fetch carries the session cookie (same-origin).
self.addEventListener("pushsubscriptionchange", (event) => {
  const key = event.oldSubscription && event.oldSubscription.options.applicationServerKey;
  event.waitUntil(
    // Some browsers give no oldSubscription; the current one (if any) still carries the key.
    (key ? Promise.resolve(key) : self.registration.pushManager.getSubscription().then((s) => s && s.options.applicationServerKey))
      .then((k) => {
        if (!k) return;
        return self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: k });
      })
      .then((sub) =>
        sub &&
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        }),
      )
      .catch(() => {}),
  );
});

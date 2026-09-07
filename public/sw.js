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
      // A second push about the same call/booking replaces the first AND re-alerts.
      renotify: !!p.tag,
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
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Reuse an open portal window (the installed app) rather than spawning a second one.
      for (const c of clients) {
        if (new URL(c.url).origin === self.location.origin && "focus" in c) {
          return c.navigate ? c.navigate(url).then((w) => (w || c).focus()) : c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

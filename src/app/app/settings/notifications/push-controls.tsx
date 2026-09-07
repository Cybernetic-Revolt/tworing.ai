"use client";

import { useEffect, useState } from "react";
import { ShareIcon, isIOS, isStandalone, pushSupported, urlBase64ToUint8Array } from "@/lib/pwa-client";

type State =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "ios-not-installed" }
  | { kind: "blocked" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string }
  | { kind: "error"; message: string };

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const av = new Uint8Array(a);
  for (let i = 0; i < av.length; i++) if (av[i] !== b[i]) return false;
  return true;
}

/**
 * The subscription this browser holds, but only if it was made with the key the server signs
 * with today. After a VAPID rotation the old one can never deliver again (the push service
 * refuses our new signature for it), so it is dropped here rather than re-registered — the
 * user then sees "off" and one tap makes a fresh one with the new key.
 */
async function currentSubscription(reg: ServiceWorkerRegistration, key: Uint8Array): Promise<PushSubscription | null> {
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return null;
  if (sameKey(sub.options.applicationServerKey, key)) return sub;
  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
  return null;
}

async function register(sub: PushSubscription): Promise<void> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) throw new Error(`server said ${res.status}`);
}

/** Browser errors in words a business owner can act on. */
function explain(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  const msg = String((err as { message?: string })?.message ?? err);
  if (name === "NotAllowedError") return "your browser didn't allow notifications for this site.";
  if (name === "AbortError" || /push service/i.test(msg)) return "your browser couldn't reach its notification service. Check the connection and try again.";
  if (/server said 503/.test(msg)) return "push isn't switched on for this server yet.";
  if (/server said/.test(msg)) return "the server didn't accept this device. Try again in a moment.";
  return "something went wrong in the browser. Reload and try again.";
}

// The device-level switch. Everything here happens in the browser: the permission prompt is
// only ever triggered by the button (a tap), the subscription is created against the
// server's VAPID public key, and the result is posted to /api/push/subscribe.
//
// The states are honest about why a device can't get push rather than showing a dead button:
// unsupported browser, iOS without installing first, permission denied in the browser.
export function PushControls({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        // iOS only exposes PushManager to Home Screen apps — so "unsupported" on an iPhone
        // almost always means "not installed yet", which is fixable.
        setState(isIOS() && !isStandalone() ? { kind: "ios-not-installed" } : { kind: "unsupported" });
        return;
      }
      if (Notification.permission === "denied") {
        setState({ kind: "blocked" });
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await currentSubscription(reg, urlBase64ToUint8Array(publicKey));
      if (cancelled) return;
      if (sub) {
        // Re-post so the server row survives a wiped database; same key, so this is a no-op update.
        await register(sub).catch(() => {});
        setState({ kind: "on", endpoint: sub.endpoint });
      } else {
        setState({ kind: "off" });
      }
    })().catch((err) => setState({ kind: "error", message: explain(err) }));
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function turnOn() {
    setBusy(true);
    try {
      // Permission is requested here and only here — inside the click handler.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? { kind: "blocked" } : { kind: "off" });
        return;
      }
      const key = urlBase64ToUint8Array(publicKey);
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await currentSubscription(reg, key)) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key as BufferSource,
        }));
      await register(sub);
      setState({ kind: "on", endpoint: sub.endpoint });
    } catch (err) {
      setState({ kind: "error", message: explain(err) });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState({ kind: "off" });
    } catch (err) {
      setState({ kind: "error", message: explain(err) });
    } finally {
      setBusy(false);
    }
  }

  const button =
    "rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 " +
    "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

  return (
    <div
      data-push-state={state.kind}
      className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        This device
      </h2>
      {state.kind === "loading" && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Checking…</p>
      )}
      {state.kind === "unsupported" && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          This browser can&apos;t receive push notifications. Try Chrome, Edge, or Safari 16.4+.
        </p>
      )}
      {state.kind === "ios-not-installed" && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          On iPhone and iPad, notifications only work once TwoRing is on your home screen.
          Tap <ShareIcon /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>,
          open TwoRing from there, and come back to this page.
        </p>
      )}
      {state.kind === "blocked" && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          Notifications are blocked for tworing.ai in your browser settings. Allow them there,
          then reload this page.
        </p>
      )}
      {state.kind === "off" && (
        <div className="mt-2 flex flex-col gap-3 text-sm">
          <p className="text-zinc-600 dark:text-zinc-400">
            Get a notification on this device the moment a call ends or a job is booked.
          </p>
          <button type="button" onClick={turnOn} disabled={busy} className={`${button} self-start`}>
            Turn on notifications
          </button>
        </div>
      )}
      {state.kind === "on" && (
        <div className="mt-2 flex flex-col gap-3 text-sm">
          <p className="text-emerald-700 dark:text-emerald-300">
            Notifications are on for this device.
          </p>
          <button
            type="button"
            onClick={turnOff}
            disabled={busy}
            className="self-start text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Turn off on this device
          </button>
        </div>
      )}
      {state.kind === "error" && (
        <div className="mt-2 flex flex-col gap-3 text-sm">
          <p className="text-red-700 dark:text-red-300">
            Couldn&apos;t turn on notifications — {state.message}
          </p>
          <button type="button" onClick={turnOn} disabled={busy} className={`${button} self-start`}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

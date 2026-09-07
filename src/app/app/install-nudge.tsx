"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ShareIcon, isIOS, isStandalone } from "@/lib/pwa-client";

const DISMISS_KEY = "tworing.installNudge.dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "hidden" | "ios" | "prompt";

// The browser's install state is external to React, so it is read through
// useSyncExternalStore: the server snapshot is always "hidden" (no flash, no hydration
// mismatch) and the client snapshot is recomputed when the browser offers an install prompt
// or the user dismisses the card.
let deferred: BeforeInstallPromptEvent | null = null;
let dismissedThisSession = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function dismissed(): boolean {
  if (dismissedThisSession) return true;
  try {
    return !!localStorage.getItem(DISMISS_KEY);
  } catch {
    return false;
  }
}

function snapshot(): Mode {
  if (isStandalone() || dismissed()) return "hidden";
  if (deferred) return "prompt";
  if (isIOS()) return "ios";
  return "hidden";
}

// "Put TwoRing on your phone" — shown on the dashboard only when the portal is NOT already
// installed, and only where the browser can actually do it: Chrome/Edge fire
// `beforeinstallprompt` and get a one-tap Install button; iOS has no such API, so it gets the
// Share → Add to Home Screen steps. Anything else (desktop Firefox, a Safari tab on a Mac)
// gets nothing — a nudge with no working action is noise.
//
// Dismissal sticks per browser. Installing is worth one ask, not a daily one.
export function InstallNudge() {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "hidden" as Mode);

  function dismiss() {
    dismissedThisSession = true;
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* storage blocked — the in-memory flag still hides it for this page */
    }
    notify();
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      deferred = null;
      dismissedThisSession = true;
      notify();
    }
  }

  if (mode === "hidden") return null;

  return (
    <div
      role="region"
      aria-label="Install TwoRing"
      className="mt-6 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-medium text-emerald-900 dark:text-emerald-100">
          {mode === "ios" ? "Put TwoRing on your home screen" : "Install TwoRing as an app"}
        </p>
        <p className="mt-0.5 text-emerald-800/80 dark:text-emerald-200/80">
          {mode === "ios" ? (
            <>
              Tap <ShareIcon /> <strong>Share</strong>, then{" "}
              <strong>Add to Home Screen</strong>. Then turn on{" "}
              <Link href="/app/settings/notifications" className="underline">
                notifications
              </Link>{" "}
              so new calls and bookings buzz your phone.
            </>
          ) : (
            <>
              Opens like an app, and new calls and bookings can{" "}
              <Link href="/app/settings/notifications" className="underline">
                notify you
              </Link>{" "}
              the moment they happen.
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {mode === "prompt" && (
          <button
            type="button"
            onClick={install}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Install
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="text-emerald-800/70 hover:text-emerald-900 dark:text-emerald-200/70 dark:hover:text-emerald-100"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRef } from "react";
import { setGoogleCalendars } from "./actions";

type Option = { id: string; summary: string };

/**
 * The per-account calendar multi-select, with a confirm that fires ONLY when a save would
 * REMOVE a calendar.
 *
 * Saving the set runs `setGoogleCalendars`, which deletes the `AppointmentGoogleEvent`
 * tracking rows for any calendar that was unticked — and unticking everything silently stops
 * that account syncing entirely. Adding a calendar is safe and needs no friction, so this does
 * not confirm every toggle (which production tools don't); it compares the boxes at submit
 * time against the set that was synced when the page loaded and asks only if the save drops
 * one or more. That keeps the common case (ticking another calendar) frictionless while making
 * the destructive case deliberate.
 */
export function CalendarPicker({
  connectionId,
  options,
  selected,
  listError,
}: {
  connectionId: string;
  options: Option[];
  selected: string[];
  listError: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const initial = new Set(selected);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = formRef.current;
    if (!form) return;
    const stillChecked = new Set(
      [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')].map((c) =>
        c.name.slice(4),
      ),
    );
    const removed = [...initial].filter((id) => !stillChecked.has(id));
    if (removed.length === 0) return; // pure add (or no change) — no confirm

    const names = options
      .filter((o) => removed.includes(o.id))
      .map((o) => o.summary)
      .join(", ");
    const message =
      stillChecked.size === 0
        ? "Remove every calendar from this account? Bookings will stop syncing to it."
        : `Stop syncing ${names}? New bookings won't be added to it (events already there stay).`;
    if (!window.confirm(message)) e.preventDefault();
  }

  return (
    <form
      ref={formRef}
      action={setGoogleCalendars}
      onSubmit={onSubmit}
      className="mt-3 flex flex-col gap-2"
    >
      <input type="hidden" name="connectionId" value={connectionId} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Calendars to sync</p>
      {listError && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Couldn&apos;t reach Google to load new calendars — Reconnect to add more. You can
          still untick the ones below.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {options.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300"
          >
            <input
              type="checkbox"
              name={`cal:${c.id}`}
              defaultChecked={initial.has(c.id)}
              className="h-4 w-4 rounded border-zinc-300 accent-emerald-600 dark:border-zinc-700"
            />
            <input type="hidden" name={`summary:${c.id}`} value={c.summary} />
            {c.summary}
          </label>
        ))}
        {options.length === 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            No calendars found on this account.
          </p>
        )}
      </div>
      <button
        type="submit"
        className="mt-1 self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Save calendars
      </button>
    </form>
  );
}

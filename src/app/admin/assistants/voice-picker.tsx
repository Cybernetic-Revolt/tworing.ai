"use client";

import { useMemo, useState } from "react";

import type { VoiceOption } from "@/lib/voices";

/**
 * Provider + voice selection for the assistant form, with an audio preview.
 *
 * The parent page is a server component and fetches the two provider voice lists; this is the
 * client piece that lets the operator flip provider, see that provider's voices, and play a
 * sample before saving. It renders real `<select name=...>` elements so the enclosing form's
 * server action picks the values up on submit.
 *
 * Two deliberate behaviours, both of which exist because the old free-text box failed
 * silently:
 *
 * - The currently-saved voice is always kept as an option even when it is not in the fetched
 *   list, flagged "(saved — not in account)", so a stale id is visible instead of vanishing.
 * - If a provider's list could not be fetched, that provider falls back to a free-text input
 *   plus a note — saving is never blocked by an unreachable voice API.
 */

const input =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const hint = "text-xs font-normal text-zinc-500 dark:text-zinc-400";

type Provider = {
  id: string;
  label: string;
  /** null when the provider's voice list could not be fetched. */
  voices: VoiceOption[] | null;
  note?: string;
};

export function VoicePicker({
  providers,
  currentProvider,
  currentVoiceId,
}: {
  providers: Provider[];
  currentProvider: string;
  currentVoiceId: string | null;
}) {
  const [provider, setProvider] = useState(currentProvider);
  const [voiceId, setVoiceId] = useState(currentVoiceId ?? "");

  const active = useMemo(
    () => providers.find((p) => p.id === provider) ?? null,
    [providers, provider],
  );

  // The saved voice must never be silently dropped, even if the account no longer lists it.
  const voices = useMemo(() => {
    const list = active?.voices ?? [];
    if (currentVoiceId && !list.some((v) => v.id === currentVoiceId)) {
      return [{ id: currentVoiceId, name: "(saved — not in account)", previewUrl: null }, ...list];
    }
    return list;
  }, [active, currentVoiceId]);

  const selected = voices.find((v) => v.id === voiceId) ?? null;

  function onProviderChange(next: string) {
    setProvider(next);
    // A Cartesia id is never a valid ElevenLabs id and vice versa, so a provider change
    // starts the choice over rather than carrying a foreign id across.
    setVoiceId("");
  }

  const hasList = active !== null && active.voices !== null;
  const knownProvider = active !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Voice provider
          <select
            name="voiceProvider"
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            className={input}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            {/* A saved provider that is not in this list must not be silently dropped. */}
            {!providers.some((p) => p.id === provider) && (
              <option value={provider}>{provider} (unknown)</option>
            )}
          </select>
        </label>

        {hasList ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Voice
            <span className={hint}>Picked by ear — no pasted IDs.</span>
            <select
              name="voiceId"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className={input}
            >
              <option value="">— choose a voice —</option>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Voice ID
            <span className={hint}>
              {knownProvider
                ? `${active?.label} list unavailable — enter the id manually.`
                : "No provider selected."}
            </span>
            <input
              name="voiceId"
              defaultValue={currentVoiceId ?? ""}
              placeholder="voice id"
              className={input}
            />
          </label>
        )}
      </div>

      {active?.note && <p className={hint}>{active.note}</p>}

      {selected?.previewUrl && (
        <Preview src={selected.previewUrl} label={`Preview ${selected.name}`} />
      )}
    </div>
  );
}

/**
 * Lazy audio mount, mirroring RecordingCell: the <audio> element is only created on click,
 * so a page never spins up a media player nobody asked for.
 */
function Preview({ src, label }: { src: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <audio
        controls
        autoPlay
        preload="none"
        src={src}
        aria-label={label}
        className="h-8 w-full max-w-xs"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="inline-flex w-fit items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      <span aria-hidden="true">▶</span> Play sample
    </button>
  );
}

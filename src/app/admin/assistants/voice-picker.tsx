"use client";

import { useMemo, useState } from "react";

import { ACCENTS, type VoiceGender, type VoiceOption } from "@/lib/voice-types";

/**
 * Provider + voice selection for the assistant form, with an audio preview.
 *
 * The parent page is a server component and fetches the two provider voice lists; this is the
 * client piece that lets the operator flip provider, narrow the list, hear a sample, and
 * choose. It renders real `<select name=...>` elements so the enclosing form's server action
 * picks the values up on submit.
 *
 * Three deliberate behaviours, all of which exist because the old free-text box failed
 * silently:
 *
 * - The currently-saved voice is always kept as an option — even when it is not in the fetched
 *   list, and even when the filters exclude it — so a stale or narrowed-out id is visible
 *   instead of vanishing and being replaced on the next save.
 * - If a provider's list could not be fetched, that provider falls back to a free-text input
 *   plus a note — saving is never blocked by an unreachable voice API.
 * - Every voice can be heard before it is chosen. ElevenLabs serves a static clip; Cartesia
 *   serves none, so those are synthesised on demand through `/api/voices/preview`. A voice
 *   chosen from a name alone is a voice nobody has actually approved.
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

/** A voice id saved earlier that the provider's list no longer contains. */
function strandedVoice(id: string): VoiceOption {
  return {
    id,
    name: "(saved — not in account)",
    previewUrl: null,
    canSynthesize: false,
    gender: "unknown",
    accent: null,
    description: null,
  };
}

const GENDERS: ReadonlyArray<{ value: VoiceGender | "any"; label: string }> = [
  { value: "any", label: "Any voice" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "neutral", label: "Neutral" },
];

function titleCase(s: string): string {
  return s
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
  const [gender, setGender] = useState<VoiceGender | "any">("any");
  const [accent, setAccent] = useState<string>("any");

  const active = useMemo(
    () => providers.find((p) => p.id === provider) ?? null,
    [providers, provider],
  );

  // The saved voice must never be silently dropped, even if the account no longer lists it.
  const all = useMemo(() => {
    const list = active?.voices ?? [];
    if (currentVoiceId && !list.some((v) => v.id === currentVoiceId)) {
      return [strandedVoice(currentVoiceId), ...list];
    }
    return list;
  }, [active, currentVoiceId]);

  // Only offer an accent that some voice in this provider's list actually has. A filter for
  // "Irish" that always yields nothing teaches the operator the filters do not work.
  const availableAccents = useMemo(() => {
    const present = new Set(all.map((v) => v.accent).filter(Boolean) as string[]);
    return ACCENTS.filter((a) => present.has(a));
  }, [all]);

  const voices = useMemo(() => {
    return all.filter((v) => {
      // The chosen voice always stays in the list, so narrowing the filters can never quietly
      // deselect it — the select would fall back to its first option and a save would write a
      // voice the operator never picked.
      if (v.id === voiceId) return true;
      if (gender !== "any" && v.gender !== gender) return false;
      if (accent !== "any" && v.accent !== accent) return false;
      return true;
    });
  }, [all, gender, accent, voiceId]);

  const selected = voices.find((v) => v.id === voiceId) ?? null;

  function onProviderChange(next: string) {
    setProvider(next);
    // A Cartesia id is never a valid ElevenLabs id and vice versa, so a provider change
    // starts the choice over rather than carrying a foreign id across.
    setVoiceId("");
    setAccent("any");
  }

  const hasList = active !== null && active.voices !== null;
  const knownProvider = active !== null;

  // ElevenLabs ships the clip; Cartesia has to be asked to speak. Both end up as a src.
  const previewSrc = selected
    ? (selected.previewUrl ??
      (selected.canSynthesize
        ? `/api/voices/preview?voice=${encodeURIComponent(selected.id)}`
        : null))
    : null;

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
            <span className={hint}>
              Picked by ear — no pasted IDs. {voices.length} to choose from.
            </span>
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

      {/* Filters are presentation only: they carry no `name`, so nothing here is submitted.
          Cartesia lists hundreds of voices and an unfiltered dropdown is not a choice anyone
          makes — they pick the first plausible name and move on. */}
      {hasList && all.length > 8 && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Narrow by
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as VoiceGender | "any")}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>

          {availableAccents.length > 1 && (
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Accent
              <select
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="any">Any accent</option>
                {availableAccents.map((a) => (
                  <option key={a} value={a}>
                    {titleCase(a)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(gender !== "any" || accent !== "any") && (
            <button
              type="button"
              onClick={() => {
                setGender("any");
                setAccent("any");
              }}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {active?.note && <p className={hint}>{active.note}</p>}

      {selected?.description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{selected.description}</p>
      )}

      {previewSrc && (
        <Preview
          key={previewSrc}
          src={previewSrc}
          label={`Preview ${selected?.name ?? "voice"}`}
          synthesized={!selected?.previewUrl}
        />
      )}
    </div>
  );
}

/**
 * Lazy audio mount, mirroring RecordingCell: the <audio> element is only created on click,
 * so a page never spins up a media player nobody asked for.
 *
 * For a synthesised preview that laziness is also what keeps the cost down — mounting one per
 * voice as the operator scrolls would bill for every voice they glanced at.
 */
function Preview({
  src,
  label,
  synthesized,
}: {
  src: string;
  label: string;
  synthesized: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        That voice could not be played — the provider may not have it on this account.
      </p>
    );
  }

  if (playing) {
    return (
      <audio
        controls
        autoPlay
        preload="none"
        src={src}
        aria-label={label}
        onError={() => setFailed(true)}
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
      {synthesized && <span className={hint}>(generated)</span>}
    </button>
  );
}

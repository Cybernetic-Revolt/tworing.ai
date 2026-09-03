/**
 * Voice vocabulary shared by the server fetchers and the client picker.
 *
 * Split from `voices.ts` because that module reads `ELEVENLABS_API_KEY` and `CARTESIA_API_KEY`,
 * and the picker is a client component. Importing a *value* from it would pull those reads
 * into the browser bundle. Next.js blanks non-public env vars there so no key would leak, but
 * "the bundler happens to erase it" is not where a credential boundary should live. Everything
 * here is pure data with nothing to leak.
 */

export type VoiceGender = "female" | "male" | "neutral" | "unknown";

export type VoiceOption = {
  id: string;
  name: string;
  /**
   * A ready-made sample clip. ElevenLabs serves one per voice; Cartesia serves none, so it is
   * null there and `canSynthesize` is how that voice gets auditioned instead.
   */
  previewUrl: string | null;
  /**
   * Whether `/api/voices/preview` can speak a sample for this voice on demand.
   *
   * Cartesia has no static clip, which used to mean its voices simply had no play button —
   * a customer picking one was choosing blind. Synthesising a line costs a fraction of a
   * cent and is the only honest way to offer the choice.
   */
  canSynthesize: boolean;
  gender: VoiceGender;
  /** Normalised accent label, e.g. `american`. Null when the vendor does not say. */
  accent: string | null;
  /** The vendor's own one-line description, shown under the name. */
  description: string | null;
};

/**
 * TTS vendors the voice engine can actually build.
 *
 * Must stay in step with switchboard's `agent/config.py::SUPPORTED_VOICE_PROVIDERS`. The
 * engine is the enforcement — it refuses a config naming anything else — but a rejection
 * there surfaces as a caller hearing the fallback greeting, so the same set is checked
 * before a save can store it.
 */
export const SUPPORTED_VOICE_PROVIDERS: readonly string[] = ["elevenlabs", "cartesia"];

/**
 * Cartesia's TTS model, pinned to the value the voice engine speaks with.
 *
 * If these drift a customer auditions a voice here and a different one answers the phone, so
 * the constant is named in both places and switchboard's `CARTESIA_MODEL` carries the same
 * note. Changing one means changing the other.
 */
export const CARTESIA_MODEL = "sonic-3";

/** Cartesia's REST contract version. Its voice list and TTS response shapes are tied to it. */
export const CARTESIA_API_VERSION = "2025-04-16";

/**
 * The accent vocabulary the filter offers.
 *
 * Short on purpose. This is a dropdown for choosing a receptionist, not a dialect taxonomy —
 * the question a customer is answering is "should this sound local?", and a list long enough
 * to need scrolling stops answering it.
 */
export const ACCENTS = [
  "american",
  "british",
  "australian",
  "canadian",
  "irish",
  "south-african",
  "indian",
  "other",
] as const;

/**
 * Both vendors' accent spellings onto `ACCENTS`.
 *
 * Matched as substrings against a lowercased label, so Cartesia's `general-american` and
 * `southern-us` and ElevenLabs' `american` all land on `american`. Order matters: the first
 * hit wins, so narrower keys come before the ones they contain.
 */
const ACCENT_ALIASES: ReadonlyArray<readonly [string, string]> = [
  ["south-african", "south-african"],
  ["south african", "south-african"],
  ["general-american", "american"],
  ["southern-us", "american"],
  ["american", "american"],
  ["transatlantic", "american"],
  ["british", "british"],
  ["english", "british"],
  ["receive", "british"], // "received pronunciation"
  ["scottish", "british"],
  ["welsh", "british"],
  ["australian", "australian"],
  ["canadian", "canadian"],
  ["irish", "irish"],
  ["indian", "indian"],
  ["hindi", "indian"],
];

/** A vendor's accent string onto the shared vocabulary, or null when it says nothing. */
export function normalizeAccent(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return null;
  for (const [needle, label] of ACCENT_ALIASES) {
    if (s.includes(needle)) return label;
  }
  return "other";
}

/** Cartesia says feminine/masculine/gender_neutral; ElevenLabs says female/male/neutral. */
export function normalizeGender(raw: string | null | undefined): VoiceGender {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "female" || s === "feminine") return "female";
  if (s === "male" || s === "masculine") return "male";
  if (s.includes("neutral")) return "neutral";
  return "unknown";
}

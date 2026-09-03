/**
 * Voice lists for the assistant voice picker, in admin and in the customer portal.
 *
 * The dropdown should offer the voices that actually exist on the provider accounts — not a
 * free-text box a person has to fill from memory. That free-text box is exactly how an
 * assistant ended up with a voice id the ElevenLabs account did not own, which made it answer
 * a call and stay silent on every utterance.
 *
 * Both fetches are best-effort and server-side only. A missing key or a failed request
 * returns `{ ok: false }` rather than throwing: the form must still render, and it falls
 * back to a free-text input so an operator is never blocked from saving.
 *
 * ## Gender and accent are vendor fields, not guesses
 *
 * Nine hundred–odd Cartesia voices is not a list anyone scrolls, so the picker filters. Both
 * vendors publish the two facts worth filtering on, and neither is inferred from the voice's
 * prose description — a parser over marketing copy would mislabel voices quietly, which is
 * the failure mode this whole module exists to avoid. ElevenLabs puts them in `labels`;
 * Cartesia puts gender in `gender` and accent in an `accents[]` array where the native one is
 * flagged. They are normalised onto one small vocabulary here so a single filter works across
 * providers rather than the UI learning two schemas.
 */

import {
  CARTESIA_API_VERSION,
  normalizeAccent,
  normalizeGender,
  type VoiceOption,
} from "@/lib/voice-types";

// Re-exported so existing importers keep working and there is still one obvious place to
// import a voice type from. The definitions live in `voice-types` because the picker is a
// client component and this module reads API keys.
export * from "@/lib/voice-types";

export type VoicesResult =
  | { ok: true; voices: VoiceOption[] }
  | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 10_000;

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

export function elevenlabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export function cartesiaConfigured(): boolean {
  return !!process.env.CARTESIA_API_KEY;
}

/** ElevenLabs — `GET https://api.elevenlabs.io/v1/voices`, key in the `xi-api-key` header. */
export async function elevenlabsVoices(): Promise<VoicesResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { ok: false, error: "no ELEVENLABS_API_KEY set" };

  let res: Response;
  try {
    res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": key },
      cache: "no-store",
      signal: timeoutSignal(),
    });
  } catch (e) {
    return { ok: false, error: `ElevenLabs unreachable: ${e instanceof Error ? e.message : e}` };
  }
  if (!res.ok) return { ok: false, error: `ElevenLabs HTTP ${res.status}` };

  const data = (await res.json()) as { voices?: Array<Record<string, unknown>> };
  const voices: VoiceOption[] = (data.voices ?? []).map((v) => {
    const labels = (v.labels ?? {}) as Record<string, string>;
    return {
      id: String(v.voice_id ?? ""),
      name: String(v.name || v.voice_id || "(unnamed)"),
      previewUrl: typeof v.preview_url === "string" && v.preview_url ? v.preview_url : null,
      // The static clip is already there and costs nothing; no reason to pay to synthesise.
      canSynthesize: false,
      gender: normalizeGender(labels.gender),
      accent: normalizeAccent(labels.accent),
      description:
        typeof v.description === "string" && v.description
          ? v.description
          : labels.description || null,
    };
  });
  return { ok: true, voices };
}

/** The native English accent a Cartesia voice speaks with, or null if it does not say. */
function cartesiaNativeAccent(v: Record<string, unknown>): string | null {
  const accents = Array.isArray(v.accents) ? (v.accents as Array<Record<string, unknown>>) : [];
  // The array lists every accent the voice can perform — a US voice also carries entries for
  // Hindi and German. Only the native `en-*` one describes how it sounds answering a phone in
  // English, and across the catalogue there is exactly one.
  const native = accents.find(
    (a) => String(a.locale ?? "").startsWith("en-") && a.is_native === true,
  );
  if (native) return normalizeAccent(String(native.accent ?? ""));
  // `country` is the fallback the catalogue itself offers when accents[] is empty.
  const country = String(v.country ?? "").toUpperCase();
  const byCountry: Record<string, string> = {
    US: "american",
    GB: "british",
    AU: "australian",
    CA: "canadian",
    IE: "irish",
    ZA: "south-african",
    IN: "indian",
  };
  return byCountry[country] ?? null;
}

/**
 * Cartesia — `GET https://api.cartesia.ai/voices`.
 *
 * Filtered to English. The catalogue is ~900 voices across a dozen languages, and a French
 * voice in the list of candidates for a Calgary phone line is noise that makes the useful
 * entries harder to find.
 */
export async function cartesiaVoices(): Promise<VoicesResult> {
  const key = process.env.CARTESIA_API_KEY;
  if (!key) return { ok: false, error: "no CARTESIA_API_KEY set" };

  let res: Response;
  try {
    res = await fetch("https://api.cartesia.ai/voices?limit=100", {
      headers: {
        "X-API-Key": key,
        "Cartesia-Version": CARTESIA_API_VERSION,
      },
      cache: "no-store",
      signal: timeoutSignal(),
    });
  } catch (e) {
    return { ok: false, error: `Cartesia unreachable: ${e instanceof Error ? e.message : e}` };
  }
  if (!res.ok) return { ok: false, error: `Cartesia HTTP ${res.status}` };

  const body = (await res.json()) as unknown;
  // The endpoint returns `{ data: [...] }`; older responses were a bare array. Accept both
  // rather than returning an empty list if the envelope changes under us.
  const list: Array<Record<string, unknown>> = Array.isArray(body)
    ? (body as Array<Record<string, unknown>>)
    : Array.isArray((body as { data?: unknown }).data)
      ? ((body as { data: Array<Record<string, unknown>> }).data)
      : [];

  const voices: VoiceOption[] = list
    .filter((v) => String(v.language ?? "en") === "en")
    .map((v) => ({
      id: String(v.id ?? ""),
      name: String(v.name || v.id || "(unnamed)"),
      previewUrl: null,
      canSynthesize: true,
      gender: normalizeGender(v.gender as string),
      accent: cartesiaNativeAccent(v),
      description:
        (typeof v.description === "string" && v.description) ||
        (typeof v.tagline === "string" && v.tagline) ||
        null,
    }));
  return { ok: true, voices };
}

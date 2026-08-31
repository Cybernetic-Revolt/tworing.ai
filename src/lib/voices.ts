/**
 * Voice lists for the admin assistant form.
 *
 * The dropdown in the assistant editor should offer the voices that actually exist on the
 * provider accounts — not a free-text box a person has to fill from memory. That free-text
 * box is exactly how an assistant ended up with a voice id the ElevenLabs account did not
 * own, which made it answer a call and stay silent on every utterance.
 *
 * Both fetches are best-effort and server-side only. A missing key or a failed request
 * returns `{ ok: false }` rather than throwing: the form must still render, and it falls
 * back to a free-text input so an operator is never blocked from saving.
 */

export type VoiceOption = {
  id: string;
  name: string;
  // ElevenLabs serves a sample clip per voice; Cartesia does not expose a static per-voice
  // preview URL, so it is null there and the picker simply shows no play button.
  previewUrl: string | null;
};

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
  const voices: VoiceOption[] = (data.voices ?? []).map((v) => ({
    id: String(v.voice_id ?? ""),
    name: String(v.name || v.voice_id || "(unnamed)"),
    previewUrl: typeof v.preview_url === "string" && v.preview_url ? v.preview_url : null,
  }));
  return { ok: true, voices };
}

/**
 * Cartesia — `GET https://api.cartesia.ai/voices`.
 *
 * ⚠️ Not wired into the voice engine yet: switchboard's entrypoint only builds ElevenLabs
 * TTS today, so a voice chosen here is stored but will not speak until a Cartesia adapter
 * ships. The picker surfaces that rather than letting a misconfiguration stay silent.
 */
export async function cartesiaVoices(): Promise<VoicesResult> {
  const key = process.env.CARTESIA_API_KEY;
  if (!key) return { ok: false, error: "no CARTESIA_API_KEY set" };

  let res: Response;
  try {
    res = await fetch("https://api.cartesia.ai/voices", {
      headers: {
        "X-API-Key": key,
        "Cartesia-Version": "2024-06-10",
      },
      cache: "no-store",
      signal: timeoutSignal(),
    });
  } catch (e) {
    return { ok: false, error: `Cartesia unreachable: ${e instanceof Error ? e.message : e}` };
  }
  if (!res.ok) return { ok: false, error: `Cartesia HTTP ${res.status}` };

  const data = (await res.json()) as unknown;
  const list = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
  const voices: VoiceOption[] = list.map((v) => ({
    id: String(v.id ?? ""),
    name: String(v.name || v.id || "(unnamed)"),
    previewUrl: null,
  }));
  return { ok: true, voices };
}

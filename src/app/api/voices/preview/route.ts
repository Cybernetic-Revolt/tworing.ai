/**
 * Speaks a sample line in a given Cartesia voice, so it can be auditioned before it is chosen.
 *
 * ElevenLabs publishes a static clip per voice and the picker just plays it. Cartesia
 * publishes none, which meant its voices had no play button at all: a customer picking one
 * was choosing a receptionist's voice from a name and a sentence of marketing copy. The only
 * way to hear a Cartesia voice is to synthesise something, so that is what this does.
 *
 * Three things it is careful about:
 *
 * * **The key never reaches the browser.** That is the entire reason this is a route and not
 *   a fetch from the picker.
 * * **The model matches the engine's.** `CARTESIA_MODEL` is shared with switchboard's
 *   `providers_livekit.CARTESIA_MODEL`; if they drift, a customer auditions one voice and a
 *   different one answers the phone.
 * * **It costs money per call.** Synthesis is billed, so this is authenticated, length-capped,
 *   and cached hard — clicking the same voice twice should not bill twice.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { CARTESIA_API_VERSION, CARTESIA_MODEL } from "@/lib/voice-types";

/**
 * What the sample says.
 *
 * A receptionist's opening line rather than a pangram: the job is judging whether this voice
 * should answer your phone, and a voice can sound fine reading anything and wrong saying
 * hello. Fixed server-side so the endpoint cannot be driven as a free TTS service.
 */
const SAMPLE_LINE = "Thanks for calling. I can book you in, or take a message.";

/** A Cartesia voice id is a UUID. Checked so a malformed id fails here, not at the vendor. */
const VOICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  // Any signed-in user may audition a voice — choosing one is the point of the portal — but
  // an anonymous caller must not be able to spend the account's credit.
  await requireSession();

  const key = process.env.CARTESIA_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Cartesia is not configured" }, { status: 503 });
  }

  const voice = req.nextUrl.searchParams.get("voice") ?? "";
  if (!VOICE_ID.test(voice)) {
    return NextResponse.json({ error: "a Cartesia voice id is required" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "Cartesia-Version": CARTESIA_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: CARTESIA_MODEL,
        transcript: SAMPLE_LINE,
        voice: { mode: "id", id: voice },
        language: "en",
        output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Cartesia unreachable: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }

  if (!res.ok) {
    // Pass the status through rather than flattening it: a 404 means the account does not own
    // that voice, which is the same class of misconfiguration the picker exists to prevent,
    // and it should not read as "preview is broken".
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Cartesia HTTP ${res.status}`, detail: detail.slice(0, 300) },
      { status: res.status === 404 ? 404 : 502 },
    );
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      // Immutable: the voice, the model and the line are all fixed, so the bytes for a given
      // voice never change. This is what stops a customer comparing voices from being billed
      // for every click.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}

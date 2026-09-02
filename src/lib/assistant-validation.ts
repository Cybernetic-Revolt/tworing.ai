/**
 * Checks an assistant configuration before it can be saved.
 *
 * These mirror the guards the voice engine already enforces when it loads a config. That
 * duplication is deliberate and worth naming: the engine is the *enforcement* — a config it
 * rejects will not answer a call — but a rejection there surfaces as a caller hearing the
 * fallback greeting. Catching the same problem in the form means it is corrected by the
 * person who caused it, seconds after they caused it, rather than by a stranger on the phone.
 *
 * Every rule here exists because the failure it prevents is silent. None of them produce an
 * error at runtime; they produce an agent that sounds fine and does the wrong thing.
 */

/** Tools that let an agent genuinely put something in a calendar. */
export const BOOKING_TOOLS = [
  "book_appointment",
  "check_availability",
  "create_calendar_event",
] as const;

/** Wording that reads as scheduling, whether or not a booking tool is attached. */
const BOOKING_INTENT =
  /\b(book|booking|schedule|scheduling|appointment|availability|reschedul)/i;

/**
 * An instruction that tells the model it must call something.
 *
 * Claude runs with thinking disabled on the live path and reaches for tools less readily
 * without an explicit push. An agent that books but was never told to call the tool discusses
 * the booking and never makes it — no error, no log line, just a customer who thinks they
 * have an appointment.
 */
const TOOL_TRIGGER = /\bmust\b[\s\S]{0,80}\b(call|use|invoke)\b/i;

const RECORDING = /\brecord(?:ed|ing|s)?\b/i;
/**
 * The OPC asks for two things, not one: say the call is recorded, and state the purpose.
 * Consent is implied by the caller continuing, and that only holds if they were told why.
 */
const RECORDING_PURPOSE =
  /\b(quality|training|accuracy|accurate|our records|record[- ]keeping|service improvement|so (?:that|we) )\b/i;

export type Draft = {
  key: string;
  greeting: string;
  systemPrompt: string;
  recordingNotice: string | null;
  recordsCall: boolean;
  announceRecording: boolean;
  voiceId: string | null;
  endCallPhrases: string[];
  tools: string[];
  transferTo: string | null;
};

/** Every problem with a draft, so the form can show them all at once. */
export function validateAssistant(d: Draft): string[] {
  const errors: string[] = [];
  const greeting = d.greeting.trim();
  const prompt = d.systemPrompt.trim();

  if (!greeting) errors.push("The greeting is empty — this is the first thing a caller hears.");
  if (!prompt) errors.push("The prompt is empty, so the agent has no instructions at all.");

  // A voice is a choice nobody has made until they make it. Defaulting one would put a
  // stranger's speech in front of this client's callers.
  if (!d.voiceId?.trim()) {
    errors.push("No voice is chosen. Pick one before this assistant can answer a call.");
  }

  // Only checked when the caller is actually told. Recording without announcing is a
  // deliberate, per-assistant choice; a MISSING notice while announcing is still an error,
  // which is why this keys off the explicit flag rather than off the notice being blank.
  if (d.recordsCall && d.announceRecording) {
    const spoken = `${greeting} ${d.recordingNotice ?? ""}`;
    if (!RECORDING.test(spoken)) {
      errors.push(
        "Recording is on but the caller is never told. Add a recording notice — PIPEDA " +
          "guidance is that the customer must be informed.",
      );
    } else if (!RECORDING_PURPOSE.test(spoken)) {
      errors.push(
        'The notice says the call is recorded but not why. State the purpose — "so we can ' +
          'book your job accurately" — because implied consent only holds if they were told.',
      );
    }
  }

  // An end-call phrase inside the greeting hangs up the moment the greeting finishes.
  const lowerGreeting = greeting.toLowerCase();
  const collides = d.endCallPhrases
    .map((p) => p.trim())
    .filter((p) => p && lowerGreeting.includes(p.toLowerCase()));
  if (collides.length) {
    errors.push(
      `The greeting contains the end-call phrase ${collides.map((c) => `"${c}"`).join(", ")}, ` +
        "so the call would hang up as soon as the greeting finished.",
    );
  }

  const books = d.tools.some((t) => (BOOKING_TOOLS as readonly string[]).includes(t));
  if (BOOKING_INTENT.test(prompt) && !books) {
    errors.push(
      "The prompt discusses booking but no booking tool is attached, so the agent would " +
        `talk about booking and silently never book. Attach one of ${BOOKING_TOOLS.join(", ")} ` +
        "or reword the prompt.",
    );
  }
  if (books && !TOOL_TRIGGER.test(prompt)) {
    errors.push(
      'This agent can book, so the prompt needs an explicit instruction like "you MUST call ' +
        'create_calendar_event before telling anyone it is booked". Without it the model ' +
        "discusses booking and often never calls the tool.",
    );
  }

  if (d.tools.includes("transferCall") && !d.transferTo?.trim()) {
    errors.push(
      "transferCall is attached but no transfer number is set — a caller asking for a " +
        "human would be handed nowhere.",
    );
  }

  return errors;
}

/**
 * Tool names the prompt mentions that are not attached.
 *
 * A warning rather than an error: prose can legitimately mention a capability. But Ada's
 * prompt named eleven tools with none attached for months, and nothing surfaced it.
 */
export function promisedButMissing(prompt: string, tools: string[]): string[] {
  const named = new Set(
    [...prompt.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\s*\(/g)].map((m) => m[1]),
  );
  return [...named].filter((n) => !tools.includes(n)).sort();
}

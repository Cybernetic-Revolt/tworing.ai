export function formatWhen(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * A call summary as it should read on a page.
 *
 * Summaries arrive from two generations of model prompt, and the older ones open with
 * markdown boilerplate — "**Call Summary:**" was visible verbatim in the calls list,
 * because the page renders plain text (correctly: rendering model output as markdown is
 * how a stray `#` becomes a giant heading). So the label is stripped and emphasis
 * markers are unwrapped here, at the seam where a summary meets a page, rather than by
 * rewriting stored rows — the stored text stays exactly what the model said.
 */
export function cleanSummary(raw: string | null): string | null {
  if (!raw) return raw;
  let s = raw.trim();
  // Leading boilerplate labels, with or without emphasis: "**Call Summary:**", "Summary:".
  s = s.replace(/^\s*(?:\*\*|__)?\s*(?:call\s+)?summary\s*:?\s*(?:\*\*|__)?\s*:?\s*/i, "");
  // Unwrap bold/italic markers; plain-text pages should never show the asterisks.
  s = s.replace(/(\*\*|__)(.+?)\1/g, "$2").replace(/(^|\s)\*(\S[^*]*\S|\S)\*(?=\s|$|[.,;:!?])/g, "$1$2");
  return s.trim() || null;
}

/**
 * The engine's `endedReason` as a person should read it.
 *
 * `endedReason` is a free-text string set by whatever ran the call — Vapi's kebab-case
 * ("customer-ended-call") and switchboard's snake_case ("agent_ended") both land in it. It was
 * being printed verbatim on the customer's call detail, which reads like a leaked internal
 * field. Mapped to plain English where we recognise it, and otherwise de-slugged rather than
 * shown raw, so an unknown future value still reads as words.
 */
const ENDED_REASON_LABELS: Record<string, string> = {
  "customer-ended-call": "Caller hung up",
  "customer_ended": "Caller hung up",
  "agent-ended": "Assistant ended the call",
  "agent_ended": "Assistant ended the call",
  "assistant-ended-call": "Assistant ended the call",
  "assistant-said-end-call-phrase": "Assistant ended the call",
  "customer-did-not-answer": "No answer",
  "silence-timed-out": "Ended after silence",
  "exceeded-max-duration": "Reached the time limit",
  "pipeline-error": "Ended early (system issue)",
  "transferred": "Transferred to a person",
};

export function formatEndedReason(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (ENDED_REASON_LABELS[key]) return ENDED_REASON_LABELS[key];
  // Unknown value: de-slug ("some_new-reason" -> "Some new reason") rather than leak it raw.
  const words = key.replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

/** A messaging channel/direction pair as a person reads it: "SMS · OUTBOUND" -> "Sent · SMS". */
export function formatMessageMeta(channel: string, direction: string): string {
  const dir = direction.toUpperCase() === "OUTBOUND" ? "Sent" : "Received";
  const chan = channel.toUpperCase() === "SMS" ? "SMS" : channel.charAt(0) + channel.slice(1).toLowerCase();
  return `${dir} · ${chan}`;
}

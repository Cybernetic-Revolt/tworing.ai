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

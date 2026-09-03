/**
 * Tags an operator can write into a script, and what they become on a call.
 *
 * The script is staff-owned and the details inside it are customer-owned, which is the whole
 * reason this exists. "Jessica" appears twenty times in a receptionist prompt; a client who
 * wants to call her Robin should not need an engineer, and should not be handed the prompt.
 * A tag is the seam: staff write `#NAME#`, the customer edits one field in the portal.
 *
 * ## Rendering happens here, not in the engine
 *
 * `by-did` resolves every tag before the config leaves the platform, so switchboard receives
 * finished text and needs to know nothing about tags. That is deliberate. The engine already
 * shipped one templating bug of exactly this shape — Vapi substituted `{{customer.number}}`
 * and switchboard never did, so for months the model read the literal string `{{customer.number}}`
 * on every call and its identify-the-caller branch could not fire. Nobody saw it, because an
 * unsubstituted variable does not raise: it just quietly becomes nonsense the model reads out.
 *
 * Two rules follow from that, and they are the point of this module:
 *
 * 1. **An unknown tag is a save-time error, never a runtime surprise.** `unknownTags` feeds
 *    the validator, so `#CLIENT#` is rejected by the person who typed it rather than spoken
 *    to a caller. This is the guard the `{{customer.number}}` bug did not have.
 * 2. **Every known tag always resolves to something sayable.** No blanks, no leftovers. A
 *    missing value falls back to a phrase that still reads as English, because a caller
 *    hearing "put you through to the owner" is recoverable and one hearing "put you through
 *    to #PRINCIPAL#" is not.
 */

/** The values a script's tags are rendered against. */
export type TemplateValues = {
  /** What the assistant calls itself out loud. */
  name: string;
  /** The business it answers for. */
  business: string;
  /** The person it ultimately works for, if one is recorded. */
  principal: string | null;
};

export type TagSpec = {
  tag: string;
  /** Shown in the admin legend, so the vocabulary is discoverable where it is used. */
  description: string;
  /** Whether a customer can change what this renders to from the portal. */
  customerEditable: boolean;
};

/**
 * The complete vocabulary. Deliberately short.
 *
 * Every tag here is a value that genuinely differs per tenant AND appears often enough in a
 * script that spelling it out would make the script unshareable. A tag that fails either test
 * earns nothing and costs a thing to learn — and each one added is another string that can
 * fail to substitute.
 */
export const TAGS: readonly TagSpec[] = [
  {
    tag: "#NAME#",
    description: "What the assistant calls itself. The client sets this in their portal.",
    customerEditable: true,
  },
  {
    tag: "#BUSINESS#",
    description: "The organisation name.",
    customerEditable: false,
  },
  {
    tag: "#PRINCIPAL#",
    description:
      "The name of the PRINCIPAL contact — who the assistant works for. Add that contact " +
      "before using this tag.",
    customerEditable: false,
  },
] as const;

/** Matches a tag-shaped token, known or not: `#`, capitals/digits/underscore, `#`. */
const TOKEN = /#[A-Z0-9_]+#/g;

const KNOWN = new Set(TAGS.map((t) => t.tag));

/**
 * Spoken when a script uses `#PRINCIPAL#` and no principal contact is recorded.
 *
 * The validator refuses that combination at save time, so this is the second line rather than
 * the first: it covers the contact being deleted *after* the script was saved, which no
 * save-time check can catch. Generic on purpose — a wrong name is worse than no name.
 */
const NO_PRINCIPAL = "the owner";

/**
 * Tag-shaped tokens in `text` that are not part of the vocabulary.
 *
 * Case-sensitive, and that is the useful behaviour: `#name#` is flagged rather than silently
 * accepted, because a tag that works in one case and not the other is a trap.
 */
export function unknownTags(text: string): string[] {
  const found = text.match(TOKEN) ?? [];
  return [...new Set(found.filter((t) => !KNOWN.has(t)))];
}

/** Known tags used in `text`, in vocabulary order. */
export function tagsUsed(text: string): string[] {
  const found = new Set(text.match(TOKEN) ?? []);
  return TAGS.map((t) => t.tag).filter((t) => found.has(t));
}

/**
 * Replace every known tag with its value.
 *
 * One pass, so a value that happens to contain a `#TAG#` — a business actually named
 * "#1 Plumbing", say — is inserted as text rather than re-scanned and substituted again.
 * Unknown tokens are left exactly as they are: `unknownTags` is what rejects them, and
 * silently deleting one here would hide the mistake instead of surfacing it.
 */
export function renderTemplate(text: string, values: TemplateValues): string {
  const map: Record<string, string> = {
    "#NAME#": values.name,
    "#BUSINESS#": values.business,
    "#PRINCIPAL#": values.principal?.trim() || NO_PRINCIPAL,
  };
  return text.replace(TOKEN, (token) => map[token] ?? token);
}

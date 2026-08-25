// Normalize a phone number to a consistent stored form so the same caller
// always maps to one lead. North-American default: 10 digits -> +1XXXXXXXXXX,
// 11 digits starting with 1 -> +1XXXXXXXXXX. Anything else is kept as +digits
// (best effort) so we never lose the number, just store it consistently.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

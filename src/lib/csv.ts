// Minimal CSV writer (RFC 4180 quoting). No deps.

function cell(v: unknown): string {
  if (v == null) return "";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  // Neutralize spreadsheet formula injection: Excel/Sheets treat a cell that
  // starts with = + - @ or a control char as a live formula, so a caller-
  // supplied value like `=HYPERLINK(...)` would execute on export. Prefix a
  // quote so it renders as text. (Quoting alone doesn't help — importers strip
  // the surrounding quotes and still evaluate the formula.)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T extends Record<string, unknown>>(
  columns: { key: keyof T; header: string }[],
  rows: T[],
): string {
  const head = columns.map((c) => cell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(","));
  return [head, ...body].join("\r\n");
}

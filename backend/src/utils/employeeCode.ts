// Employee code formats a company can pick; {P} = prefix, {N} = running number
export const CODE_FORMATS = {
  prefix_seq: "{P}{N}", // ACME001
  prefix_dash_seq: "{P}-{N}", // ACME-001
  prefix_year_seq: "{P}/{YYYY}/{N}", // ACME/2026/001 — numbering restarts every year
  prefix_yy_seq: "{P}{YY}{N}", // ACME26001 — numbering restarts every year
} as const;
export type CodeFormat = keyof typeof CODE_FORMATS;
export const CODE_FORMAT_KEYS = Object.keys(CODE_FORMATS) as [CodeFormat, ...CodeFormat[]];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Formats with their own separator don't double a trailing "-" or "/" on the prefix
function cleanPrefix(prefix: string, format: CodeFormat) {
  return format === "prefix_seq" || format === "prefix_yy_seq" ? prefix : prefix.replace(/[-/]+$/, "");
}

function parts(prefix: string, format: CodeFormat, year: number) {
  const P = cleanPrefix(prefix, format);
  const [head] = CODE_FORMATS[format].replace("{P}", P).replace("{YYYY}", String(year)).replace("{YY}", String(year).slice(-2)).split("{N}");
  return head;
}

export function buildCode(prefix: string, format: CodeFormat, digits: number, seq: number, year: number) {
  return `${parts(prefix, format, year)}${String(seq).padStart(digits, "0")}`;
}

// Next code after the highest one already used with this pattern (this year's, for year formats)
export function nextCode(existing: (string | null)[], prefix: string, format: CodeFormat, digits: number, year: number) {
  const re = new RegExp(`^${escape(parts(prefix, format, year))}(\\d+)$`, "i");
  // Codes made with a longer pattern (e.g. ACME26001 when counting ACME001) aren't ours
  const others = CODE_FORMAT_KEYS.filter((f) => f !== format && parts(prefix, f, year).length > parts(prefix, format, year).length).map(
    (f) => new RegExp(`^${escape(parts(prefix, f, year))}\\d{${digits},}$`, "i"),
  );
  let max = 0;
  for (const code of existing) {
    const m = code && !others.some((o) => o.test(code.trim())) ? re.exec(code.trim()) : null;
    if (m) max = Math.max(max, Number(m[1]));
  }
  return buildCode(prefix, format, digits, max + 1, year);
}

// No prefix set: first letters of the company name, e.g. "Acme Software" → "AS", "Microsoft" → "MIC"
export function defaultPrefix(companyName: string) {
  const words = companyName.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (!words.length) return "EMP";
  return words.length > 1 ? words.map((w) => w[0]).join("").slice(0, 4) : words[0].slice(0, 3);
}

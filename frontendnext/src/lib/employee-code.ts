// Employee code formats (same as the backend's utils/employeeCode.ts) — for picking and previewing
export const CODE_FORMATS = [
  { value: "prefix_seq", label: "Prefix + number", example: (p: string, y: number, n: string) => `${p}${n}` },
  { value: "prefix_dash_seq", label: "Prefix - number", example: (p: string, y: number, n: string) => `${clean(p)}-${n}` },
  { value: "prefix_year_seq", label: "Prefix / year / number", example: (p: string, y: number, n: string) => `${clean(p)}/${y}/${n}` },
  { value: "prefix_yy_seq", label: "Prefix + year + number", example: (p: string, y: number, n: string) => `${p}${String(y).slice(-2)}${n}` },
] as const;

export const CODE_DIGITS = ["2", "3", "4", "5", "6"];

const clean = (p: string) => p.replace(/[-/]+$/, "");

// "ISP", "prefix_year_seq", 3 → "ISP/2026/001"
export function previewCode(prefix: string, format: string, digits: number) {
  const f = CODE_FORMATS.find((x) => x.value === format) ?? CODE_FORMATS[0];
  return f.example(prefix.trim().toUpperCase() || "EMP", new Date().getFullYear(), "1".padStart(digits, "0"));
}

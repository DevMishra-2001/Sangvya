import type { ReportResult } from "../types.js";

// Cells starting with = + - @ would run as formulas in Excel (CSV injection)
const safe = (v: unknown) => {
  const s = v == null ? "" : String(v);
  const guarded = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

export function toCsv(r: ReportResult): Buffer {
  const lines = [r.columns.map((c) => safe(c.label)).join(",")];
  for (const row of r.rows) lines.push(r.columns.map((c) => safe(row[c.key])).join(","));
  if (r.totals) lines.push(r.columns.map((c) => safe(r.totals![c.key])).join(","));
  return Buffer.from("﻿" + lines.join("\r\n"), "utf8"); // BOM so Excel reads UTF-8 (₹, names)
}

import type { Brand } from "../branding.js";
import type { Cell, Column, ReportResult } from "../types.js";
import { INK, LINE, MUTED, openPdf } from "./pdfLayout.js";

const fmt = (c: Column, v: Cell) => {
  if (v == null || v === "") return "";
  if (c.type === "money") return Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (c.type === "date" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  return String(v);
};

// A report as an A4 PDF: letterhead, the table (header repeats on each page), totals
export function toPdf(r: ReportResult, brand: Brand, printedBy?: string): Promise<Buffer> {
  const page = openPdf(brand, { title: r.title, subtitle: r.subtitle, landscape: r.landscape, printedBy });
  const { doc, left, width } = page;
  const cols = r.columns;
  const weights = cols.map((c) => c.width ?? Math.max(6, c.label.length + 2));
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (w / sum) * width);
  const fs = cols.length > 20 ? 6.5 : cols.length > 9 ? 7.5 : 8.5;
  const pad = (i: number) => (widths[i] < 22 ? 1 : 4);
  const rowH = fs + 9;
  const alignOf = (c: Column) => (c.type === "number" || c.type === "money" ? "right" : c.type === "code" ? "center" : "left");

  const header = () => {
    doc.font("Helvetica-Bold").fontSize(fs);
    const h = Math.max(...cols.map((c, i) => doc.heightOfString(c.label, { width: widths[i] - pad(i) * 2 }))) + 9;
    const y = doc.y;
    doc.rect(left, y, width, h).fill("#F1F5F9");
    let x = left;
    doc.fillColor("#334155");
    cols.forEach((c, i) => {
      doc.text(c.label, x + pad(i), y + 4.5, { width: widths[i] - pad(i) * 2, align: alignOf(c) });
      x += widths[i];
    });
    doc.moveTo(left, y + h).lineTo(left + width, y + h).lineWidth(0.8).strokeColor("#CBD5E1").stroke();
    doc.y = y + h;
  };

  const row = (cells: string[], opts: { bold?: boolean; shade?: boolean } = {}) => {
    if (doc.y + rowH > page.bottom()) {
      page.newPage();
      header();
    }
    const y = doc.y;
    if (opts.shade) doc.rect(left, y, width, rowH).fill("#F8FAFC");
    if (opts.bold) doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.8).strokeColor(INK).stroke();
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(fs).fillColor(INK);
    let x = left;
    cells.forEach((text, i) => {
      doc.text(text, x + pad(i), y + 4.5, { width: widths[i] - pad(i) * 2, align: alignOf(cols[i]), lineBreak: false, ellipsis: true });
      x += widths[i];
    });
    doc.moveTo(left, y + rowH).lineTo(left + width, y + rowH).lineWidth(0.4).strokeColor(LINE).stroke();
    doc.y = y + rowH;
  };

  header();
  if (r.rows.length === 0) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Nothing to show for these filters.", left, doc.y + 14, { width, align: "center" });
  }
  r.rows.forEach((x, i) => row(cols.map((c) => fmt(c, x[c.key] ?? null)), { shade: i % 2 === 1 }));
  if (r.totals && r.rows.length) row(cols.map((c) => fmt(c, r.totals![c.key] ?? null)), { bold: true });
  return page.finish();
}

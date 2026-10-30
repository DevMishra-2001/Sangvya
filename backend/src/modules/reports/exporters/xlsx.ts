import ExcelJS from "exceljs";
import type { Column, ReportResult } from "../types.js";

const numFmt = (c: Column) => (c.type === "money" ? "#,##0.00" : c.type === "number" ? "0.##" : undefined);

export async function toXlsx(r: ReportResult, meta: { company: string; printedBy?: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Workkind";
  wb.created = new Date();
  const ws = wb.addWorksheet(r.title.slice(0, 31));

  const at = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  ws.addRow([meta.company]).font = { bold: true, size: 12 };
  ws.addRow([r.title]).font = { bold: true, size: 14 };
  ws.addRow([r.subtitle ?? ""]).font = { color: { argb: "FF64748B" } };
  ws.addRow([`Printed by: ${meta.printedBy ?? "—"}`, "", `Printed at: ${at}`]).font = { color: { argb: "FF64748B" }, size: 9 };
  ws.addRow([]);
  const headerRow = 6;

  const header = ws.addRow(r.columns.map((c) => c.label));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });

  for (const row of r.rows) ws.addRow(r.columns.map((c) => row[c.key] ?? null));
  if (r.totals) {
    const t = ws.addRow(r.columns.map((c) => r.totals![c.key] ?? null));
    t.font = { bold: true };
    t.eachCell((cell) => (cell.border = { top: { style: "thin" } }));
  }

  r.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.width ?? Math.max(10, Math.min(40, c.label.length + 2));
    const fmt = numFmt(c);
    if (fmt) col.numFmt = fmt;
    if (c.type === "number" || c.type === "money") col.alignment = { horizontal: "right" };
    if (c.type === "code") col.alignment = { horizontal: "center" };
  });
  ws.views = [{ state: "frozen", ySplit: headerRow, xSplit: 1 }]; // header row + first column stay visible
  ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: r.columns.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

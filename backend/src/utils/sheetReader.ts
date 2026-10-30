import ExcelJS from "exceljs";
import { BadRequestError } from "./httpErrors.js";

export type SheetFormat = "csv" | "xlsx";

// Uploaded file name → format, or null if we can't read it
export function sheetFormat(fileName: string): SheetFormat | null {
  const ext = fileName.toLowerCase().split(".").pop();
  return ext === "csv" ? "csv" : ext === "xlsx" ? "xlsx" : null;
}

// RFC 4180 CSV: quoted fields, "" escapes, CRLF/LF; comma or semicolon delimiter
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const pad = (n: number) => String(n).padStart(2, "0");

// One Excel cell → text (dates as YYYY-MM-DD, links/rich text/formulas → their text)
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("error" in v) return "";
  }
  return String(v);
}

// First worksheet of an .xlsx as rows of text
async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadRequestError("This Excel file couldn't be read — save it as .xlsx and try again");
  }
  const ws = wb.worksheets.find((w) => w.state === "visible") ?? wb.worksheets[0];
  if (!ws) return [];
  const width = ws.columnCount;
  const rows: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    rows.push(Array.from({ length: width }, (_, c) => cellText(row.getCell(c + 1).value)));
  }
  return rows;
}

// File → trimmed rows, blank rows dropped (each keeps its line number in the file)
export async function readSheet(buffer: Buffer, format: SheetFormat): Promise<{ line: number; cells: string[] }[]> {
  const raw = format === "csv" ? parseCsv(buffer.toString("utf8")) : await parseXlsx(buffer);
  return raw
    .map((cells, i) => ({ line: i + 1, cells: cells.map((c) => c.trim()) }))
    .filter((r) => r.cells.some((c) => c !== ""));
}

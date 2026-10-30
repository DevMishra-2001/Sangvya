import ExcelJS from "exceljs";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db } from "../../../config/db.js";
import { departments, designations, roles, shifts } from "../../../db/schema.js";
import { IMPORT_COLUMNS } from "./importColumns.js";

const MAX_ROW = 1001;
const colLetter = (i: number) => String.fromCharCode(65 + i);

// Blank CSV with just the header row
export function csvTemplate(): Buffer {
  return Buffer.from("﻿" + IMPORT_COLUMNS.map((c) => c.header).join(",") + "\r\n", "utf8");
}

// Excel template: an Employees sheet with dropdowns, plus How to fill and Lists sheets
export async function xlsxTemplate(companyId: number): Promise<Buffer> {
  const [shiftRows, roleRows, desigRows, deptRows] = await Promise.all([
    db.select({ name: shifts.name }).from(shifts).where(and(eq(shifts.company_id, companyId), eq(shifts.is_active, true))).orderBy(asc(shifts.name)),
    db
      .select({ name: roles.name, key: roles.key })
      .from(roles)
      .where(and(eq(roles.is_active, true), or(isNull(roles.company_id), eq(roles.company_id, companyId))))
      .orderBy(asc(roles.level)),
    db.select({ name: designations.name }).from(designations).where(and(eq(designations.company_id, companyId), eq(designations.is_active, true))).orderBy(asc(designations.name)),
    db.select({ name: departments.name }).from(departments).where(and(eq(departments.company_id, companyId), eq(departments.is_active, true))).orderBy(asc(departments.name)),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Workkind";
  const ws = wb.addWorksheet("Employees", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = IMPORT_COLUMNS.map((c) => ({ header: c.key === "name" ? `${c.header} *` : c.header, key: c.key, width: c.width }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  head.alignment = { vertical: "middle" };
  head.height = 22;
  IMPORT_COLUMNS.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    if (c.hint) cell.note = c.hint;
    if (c.text) ws.getColumn(i + 1).numFmt = "@";
    if (c.date) ws.getColumn(i + 1).numFmt = "dd/mm/yyyy";
  });

  // Lists sheet feeds the dropdowns (and shows what already exists)
  const lists = wb.addWorksheet("Lists");
  const listCols: [string, string[]][] = [
    ["Gender", ["Male", "Female", "Other"]],
    ["Employment type", ["Full time", "Part time", "Contract", "Intern"]],
    ["Shift", shiftRows.map((r) => r.name)],
    ["Role", roleRows.filter((r) => r.key !== "superadmin").map((r) => r.name)],
    ["Designation", desigRows.map((r) => r.name)],
    ["Department", deptRows.map((r) => r.name)],
  ];
  listCols.forEach(([title, values], i) => {
    const col = lists.getColumn(i + 1);
    col.width = 24;
    lists.getCell(1, i + 1).value = title;
    values.forEach((v, j) => (lists.getCell(j + 2, i + 1).value = v));
  });
  lists.getRow(1).font = { bold: true };

  const dropdown = (key: string, listIndex: number, strict: boolean) => {
    const values = listCols[listIndex][1];
    if (!values.length) return;
    const col = colLetter(IMPORT_COLUMNS.findIndex((c) => c.key === key));
    const ref = `Lists!$${colLetter(listIndex)}$2:$${colLetter(listIndex)}$${values.length + 1}`;
    for (let r = 2; r <= MAX_ROW; r++) {
      ws.getCell(`${col}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [ref],
        showErrorMessage: strict,
        errorStyle: strict ? "stop" : "information",
        error: `Pick a value from the list`,
      };
    }
  };
  dropdown("gender", 0, true);
  dropdown("type", 1, true);
  dropdown("shift", 2, true);
  dropdown("role", 3, true);
  dropdown("designation", 4, false); // new names are allowed
  dropdown("department", 5, false);

  // How to fill: one line per column, with an example
  const help = wb.addWorksheet("How to fill");
  help.columns = [
    { header: "Column", width: 26 },
    { header: "What to enter", width: 46 },
    { header: "Example", width: 22 },
  ];
  help.getRow(1).font = { bold: true };
  for (const c of IMPORT_COLUMNS) help.addRow([c.key === "name" ? `${c.header} *` : c.header, c.hint || "Optional", c.example]);
  help.addRow([]);
  help.addRow(["Notes", "Fill the Employees sheet, one person per row. Only Name is required."]);
  help.addRow(["", "Reports to can point to someone in the same file."]);
  help.addRow(["", "Up to 1000 rows per file. You'll see a check of every row before anything is saved."]);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

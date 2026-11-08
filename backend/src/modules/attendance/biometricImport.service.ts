// Biometric machine import: punch logs (one row per punch) or daily In/Out sheets from CSV, Excel or the
// machine's .txt/.dat log. Machine user IDs are matched to employee codes; first punch = in, last = out.
import ExcelJS from "exceljs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { attendance, attendancePunches, employees } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError } from "../../utils/httpErrors.js";
import { parseCsv } from "../../utils/sheetReader.js";
import { localDate, zonedDateTime } from "../../utils/workday.js";
import { lateMinutes, rulesForEmployees } from "../shifts/shiftRules.js";

type UploadedFile = { originalname: string; buffer: Buffer };
type Punch = { code: string; date: string; time: string; line: number };
type LineError = { line: number; message: string };

const LOCATION = "Biometric";
const MAX_ERRORS = 50;
const pad = (n: number) => String(n).padStart(2, "0");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Header names machines use, normalised
const ALIASES = {
  code: ["empcode", "employeecode", "employeeid", "empid", "empno", "employeeno", "userid", "user", "enrollno", "enrollnumber", "enrollid", "acno", "badgenumber", "badgeno", "cardno", "code", "id", "staffcode", "staffid", "personid", "pin", "machineid", "biometricid"],
  datetime: ["datetime", "punchdatetime", "logdatetime", "logtime", "checktime", "timestamp", "attendancetime", "punchtimestamp", "recordtime"],
  date: ["date", "logdate", "punchdate", "attendancedate", "workdate", "attdate", "day"],
  time: ["time", "punchtime", "logtimeonly", "clocktime"],
  in: ["in", "intime", "firstin", "checkin", "punchin", "inpunch", "timein", "entry", "entrytime"],
  out: ["out", "outtime", "lastout", "checkout", "punchout", "outpunch", "timeout", "exit", "exittime"],
} as const;
type Col = keyof typeof ALIASES;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "2026-11-03", "03/11/2026", "03-Nov-2026", "3 Nov 26" → YYYY-MM-DD (day first, as Indian machines print)
function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = /^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s,]+(\d{2,4})/.exec(s))) [d, m, y] = [Number(r[1]), MONTHS.indexOf(r[2].toLowerCase()) + 1, Number(r[3])];
  else return null;
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return new Date(`${iso}T00:00:00Z`).getUTCDate() === d ? iso : null;
}

// "9:05", "09:05:33", "6:30 PM" → HH:MM:SS
function parseTime(raw: string): string | null {
  const r = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i.exec(raw);
  if (!r) return null;
  let h = Number(r[1]);
  const mi = Number(r[2]);
  const se = Number(r[3] ?? 0);
  const ap = r[4]?.[0]?.toLowerCase();
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  if (h > 23 || mi > 59 || se > 59) return null;
  return `${pad(h)}:${pad(mi)}:${pad(se)}`;
}

// Excel cell → text that keeps the time part (dates as "YYYY-MM-DD HH:MM:SS", time-only cells as "HH:MM:SS")
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const time = `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}:${pad(v.getUTCSeconds())}`;
    if (v.getUTCFullYear() < 1901) return time;
    const day = `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
    return time === "00:00:00" ? day : `${day} ${time}`;
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    return "";
  }
  return String(v);
}

async function readRows(file: UploadedFile): Promise<string[][]> {
  const ext = file.originalname.toLowerCase().split(".").pop();
  if (ext === "csv") return parseCsv(file.buffer.toString("utf8"));
  if (ext === "txt" || ext === "dat") {
    const text = file.buffer.toString("utf8").replace(/^﻿/, "");
    const lines = text.split(/\r?\n/);
    // Tab / comma separated with a header → like CSV; otherwise split on whitespace (ZKTeco attlog)
    const sep = lines[0]?.includes("\t") ? "\t" : lines[0]?.includes(",") ? "," : null;
    return lines.map((l) => (sep ? l.split(sep) : l.trim().split(/\s+/)));
  }
  if (ext === "xlsx") {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestError("This Excel file couldn't be read — save it as .xlsx and try again");
    }
    const ws = wb.worksheets.find((w) => w.state === "visible") ?? wb.worksheets[0];
    if (!ws) return [];
    const rows: string[][] = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      rows.push(Array.from({ length: ws.columnCount }, (_, c) => cellText(row.getCell(c + 1).value)));
    }
    return rows;
  }
  throw new BadRequestError("Upload a .csv, .xlsx, .txt or .dat file");
}

// Rows → punches (and the format we recognised)
function toPunches(rows: string[][]) {
  const errors: LineError[] = [];
  const punches: Punch[] = [];
  const cells = rows.map((r, i) => ({ line: i + 1, cells: r.map((c) => (c ?? "").trim()) })).filter((r) => r.cells.some(Boolean));

  // Header: the first of the top 15 rows that names an ID column and some date/time column
  let header = -1;
  let cols: Partial<Record<Col, number>> = {};
  for (let i = 0; i < Math.min(15, cells.length) && header < 0; i++) {
    const found: Partial<Record<Col, number>> = {};
    cells[i].cells.forEach((c, idx) => {
      const n = norm(c);
      for (const key of Object.keys(ALIASES) as Col[]) {
        if (found[key] == null && (ALIASES[key] as readonly string[]).includes(n)) found[key] = idx;
      }
    });
    if (found.code != null && (found.datetime != null || found.date != null || found.time != null || found.in != null)) {
      header = i;
      cols = found;
    }
  }

  const add = (code: string, date: string | null, time: string | null, line: number, what = "date/time") => {
    if (!code) return errors.push({ line, message: "No employee ID" });
    if (!date || !time) return errors.push({ line, message: `Couldn't read the ${what}` });
    punches.push({ code, date, time, line });
  };

  if (header < 0) {
    // No header: "ID  2026-11-03 09:01:22 ..." (machine log)
    for (const { line, cells: c } of cells) {
      const code = c[0];
      const rest = c.slice(1).join(" ");
      const date = parseDate(rest.replace(/^\D*/, "")) ?? parseDate(c[1] ?? "");
      const time = parseTime(rest.replace(/^\S+\s*/, "")) ?? parseTime(rest);
      if (!date && !time) continue; // title or blank-ish line
      add(code, date, time, line);
    }
    return { format: "machine log", punches, errors };
  }

  const daily = cols.in != null || cols.out != null;
  for (const { line, cells: c } of cells.slice(header + 1)) {
    const code = c[cols.code!];
    if (!code || norm(code) === norm(cells[header].cells[cols.code!])) continue;
    const dt = cols.datetime != null ? c[cols.datetime] : "";
    const dateText = cols.date != null ? c[cols.date] : dt;
    const date = parseDate(dateText) ?? parseDate(dt);
    if (daily) {
      const inT = cols.in != null ? parseTime(c[cols.in]) : null;
      const outT = cols.out != null ? parseTime(c[cols.out]) : null;
      if (!inT && !outT) continue; // absent / holiday row
      if (inT) add(code, date, inT, line, "date");
      if (outT) add(code, date, outT, line, "date");
    } else {
      const timeText = cols.time != null ? c[cols.time] : dt;
      // A "time" column that also holds the date
      const d2 = date ?? parseDate(timeText);
      add(code, d2, parseTime(timeText.replace(/^\S*\d{4}\S*\s+/, "")) ?? parseTime(timeText), line);
    }
  }
  return { format: daily ? "daily in/out" : "punch log", punches, errors };
}

// Machine ID → employee: the exact code, else a plain number matching the number at the end of one code (12 → ISP012)
async function matcher(companyId: number) {
  const people = await db
    .select({ id: employees.id, name: employees.name, code: employees.employee_code, status: employees.status, exit_date: employees.exit_date })
    .from(employees)
    .where(eq(employees.company_id, companyId));
  const byCode = new Map(people.filter((p) => p.code).map((p) => [p.code!.toLowerCase(), p]));
  const byNumber = new Map<number, (typeof people)[number] | null>();
  for (const p of people) {
    const n = /(\d+)$/.exec(p.code ?? "")?.[1];
    if (!n) continue;
    const key = Number(n);
    byNumber.set(key, byNumber.has(key) ? null : p); // null = two people end in the same number
  }
  return (code: string) => byCode.get(code.toLowerCase()) ?? (/^\d+$/.test(code) ? (byNumber.get(Number(code)) ?? undefined) : undefined);
}

async function analyse(companyId: number, file: UploadedFile | undefined) {
  if (!file) throw new BadRequestError("Choose the file exported from the machine");
  const rows = await readRows(file);
  const { format, punches, errors } = toPunches(rows);
  if (!punches.length) throw new BadRequestError(errors.length ? `No punches could be read (line ${errors[0].line}: ${errors[0].message})` : "No punches found — is this the attendance log export?");
  const match = await matcher(companyId);
  const today = localDate();

  const days = new Map<string, { employeeId: number; name: string; code: string; date: string; times: string[] }>();
  const unmatched = new Map<string, number>();
  let future = 0;
  for (const p of punches) {
    const e = match(p.code);
    if (!e) {
      unmatched.set(p.code, (unmatched.get(p.code) ?? 0) + 1);
      continue;
    }
    if (p.date > today) {
      future++;
      continue;
    }
    if (e.status === "exited" && e.exit_date && p.date > e.exit_date) continue;
    const key = `${e.id}|${p.date}`;
    const day = days.get(key) ?? { employeeId: e.id, name: e.name, code: e.code ?? p.code, date: p.date, times: [] };
    day.times.push(p.time);
    days.set(key, day);
  }
  const list = [...days.values()].map((d) => {
    const times = [...new Set(d.times)].sort();
    return { ...d, times, in: times[0], out: times.length > 1 ? times[times.length - 1] : null };
  });
  list.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

  const people = new Map<number, { name: string; code: string; days: number }>();
  for (const d of list) {
    const p = people.get(d.employeeId) ?? { name: d.name, code: d.code, days: 0 };
    p.days++;
    people.set(d.employeeId, p);
  }
  if (future) errors.unshift({ line: 0, message: `${future} punch${future === 1 ? "" : "es"} dated in the future were skipped` });
  return {
    format,
    punches: punches.length,
    from: list[0]?.date ?? null,
    to: list[list.length - 1]?.date ?? null,
    days: list,
    people: [...people.values()].sort((a, b) => a.name.localeCompare(b.name)),
    unmatched: [...unmatched.entries()].map(([code, count]) => ({ code, punches: count })),
    errors: errors.slice(0, MAX_ERRORS),
    errorCount: errors.length,
  };
}

// POST /attendance/import/check → what would be saved, nothing written
export async function checkBiometricImport(companyId: number, file: UploadedFile | undefined) {
  const a = await analyse(companyId, file);
  return { ...a, days: a.days.slice(0, 30), dayCount: a.days.length };
}

// POST /attendance/import → saves the matched days; existing punches are kept (earliest in, latest out wins)
export async function runBiometricImport(companyId: number, actor: Express.AuthUser, file: UploadedFile | undefined) {
  const a = await analyse(companyId, file);
  if (!a.days.length) throw new BadRequestError("Nothing to import — none of the IDs in the file match an employee code");
  const rules = await rulesForEmployees(companyId, [...new Set(a.days.map((d) => d.employeeId))]);
  const today = localDate();
  const now = new Date();
  const at = (date: string, time: string) => new Date(zonedDateTime(date, time.slice(0, 5)).getTime() + Number(time.slice(6, 8)) * 1000);

  let saved = 0;
  await db.transaction(async (tx) => {
    for (let i = 0; i < a.days.length; i += 500) {
      const chunk = a.days.slice(i, i + 500).map((d) => {
        const inAt = at(d.date, d.in);
        const outAt = d.out ? at(d.date, d.out) : null;
        const r = rules.get(d.employeeId);
        return {
          day: d,
          inAt,
          outAt,
          row: {
            company_id: companyId,
            employee_id: d.employeeId,
            date: d.date,
            status: "present",
            punch_in: inAt,
            punch_out: outAt,
            punch_in_location: LOCATION,
            punch_out_location: outAt ? LOCATION : null,
            late_minutes: r ? lateMinutes(r, inAt) : 0,
            // Past days are complete: no end-of-day alert for them
            day_closed_at: d.date < today ? now : null,
          },
        };
      });
      const rows = await tx
        .insert(attendance)
        .values(chunk.map((c) => c.row))
        .onConflictDoUpdate({
          target: [attendance.employee_id, attendance.date],
          set: {
            status: sql`case when ${attendance.status} = 'half' then 'half' else 'present' end`,
            punch_in: sql`least(${attendance.punch_in}, excluded.punch_in)`,
            punch_out: sql`greatest(${attendance.punch_out}, excluded.punch_out)`,
            punch_in_location: sql`case when ${attendance.punch_in} is null or excluded.punch_in < ${attendance.punch_in} then excluded.punch_in_location else ${attendance.punch_in_location} end`,
            punch_out_location: sql`case when excluded.punch_out is not null and (${attendance.punch_out} is null or excluded.punch_out > ${attendance.punch_out}) then excluded.punch_out_location else ${attendance.punch_out_location} end`,
            late_minutes: sql`case when ${attendance.punch_in} is not null and ${attendance.punch_in} <= excluded.punch_in then ${attendance.late_minutes} else excluded.late_minutes end`,
            day_closed_at: sql`coalesce(${attendance.day_closed_at}, excluded.day_closed_at)`,
          },
        })
        .returning({ id: attendance.id, employee_id: attendance.employee_id, date: attendance.date });
      saved += rows.length;

      // Punch history: the machine's in and out, skipping ones already there (re-import of the same file)
      const idOf = new Map(rows.map((r) => [`${r.employee_id}|${r.date}`, r.id]));
      const ids = rows.map((r) => r.id);
      const have = await tx
        .select({ attendance_id: attendancePunches.attendance_id, punched_at: attendancePunches.punched_at })
        .from(attendancePunches)
        .where(and(eq(attendancePunches.company_id, companyId), inArray(attendancePunches.attendance_id, ids)));
      const seen = new Set(have.map((h) => `${h.attendance_id}|${new Date(h.punched_at).getTime()}`));
      const punches = chunk.flatMap((c) => {
        const id = idOf.get(`${c.day.employeeId}|${c.day.date}`)!;
        const list: { kind: "in" | "out"; at: Date }[] = [{ kind: "in", at: c.inAt }];
        if (c.outAt) list.push({ kind: "out", at: c.outAt });
        return list
          .filter((p) => !seen.has(`${id}|${p.at.getTime()}`))
          .map((p) => ({ company_id: companyId, attendance_id: id, kind: p.kind, punched_at: p.at, location: LOCATION, remarks: "Imported from the biometric machine" }));
      });
      if (punches.length) await tx.insert(attendancePunches).values(punches);
    }
  });

  audit(actor, { companyId, action: "attendance.imported", target: ["company", companyId], summary: `Imported ${saved} attendance days from a biometric file (${a.from} to ${a.to})` });
  return { saved, people: a.people.length, from: a.from, to: a.to, unmatched: a.unmatched, errorCount: a.errorCount };
}

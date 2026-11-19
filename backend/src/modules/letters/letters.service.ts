// HR letters: company templates (letterhead + rich text with {{variables}}), letters made for employees
// (draft → issued with a number and a stored PDF), the letters register, and an employee's own letters.
import { and, asc, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { employeeLetters, employees, letterTemplates, users, type LetterDoc, type LetterSnapshot, type LetterType } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { auditNames } from "../../utils/auditNames.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/httpErrors.js";
import { stamp } from "../../utils/stamp.js";
import { localDate } from "../../utils/workday.js";
import { getEmployeeById } from "../employees/employees.service.js";
import { notify } from "../notifications/notify.js";
import { loadBrand } from "../reports/branding.js";
import { storeFile, type UploadedFile } from "../upload/upload.service.js";
import { fetchPrivateFile, letterheadPng, renderLetter } from "./letterPdf.js";
import { LETTER_LABEL, LETTER_PREFIX, starterFor } from "./letterTypes.js";
import { VARIABLES, fillValues, longDate, type SalaryRow } from "./placeholders.js";
import type { LetterInput, RegisterQuery, TemplateInput } from "./letters.schema.js";

type TemplateRow = typeof letterTemplates.$inferSelect;

// ---- Helpers ----

const folderOf = (companyId: number) => `${env.IMAGEKIT_FOLDER}/companies/${companyId}/letters/templates/`;
function checkTemplateFile(companyId: number, path: string | null | undefined) {
  if (path && !path.startsWith(folderOf(companyId))) throw new BadRequestError("Unknown file — upload it again");
}

// Every {{variable}} key used in a body
function variablesIn(node: LetterDoc, found = new Set<string>()): Set<string> {
  if ((node.type === "variable" || node.type === "variableBlock") && typeof node.attrs?.key === "string") found.add(node.attrs.key);
  for (const c of node.content ?? []) variablesIn(c, found);
  return found;
}

const snapshotOf = (t: TemplateRow): LetterSnapshot => ({
  body: t.body,
  letterhead_mode: t.letterhead_mode,
  letterhead_path: t.letterhead_mode === "upload" ? t.letterhead_path : null,
  page_numbers: t.page_numbers,
  margins: { top: t.margin_top, bottom: t.margin_bottom, left: t.margin_left, right: t.margin_right },
  signatory_name: t.signatory_name,
  signatory_title: t.signatory_title,
  signature_path: t.signature_path,
  version: t.version,
});

const templateRow = (i: TemplateInput) => ({
  type: i.type,
  name: i.name,
  title: i.title ?? null,
  letterhead_mode: i.letterheadMode,
  letterhead_path: i.letterheadMode === "upload" ? (i.letterheadPath ?? null) : null,
  letterhead_name: i.letterheadMode === "upload" && i.letterheadPath ? (i.letterheadName ?? null) : null,
  page_numbers: i.pageNumbers,
  margin_top: i.marginTop,
  margin_bottom: i.marginBottom,
  margin_left: i.marginLeft,
  margin_right: i.marginRight,
  body: i.body as LetterDoc,
  fields: i.fields,
  signatory_name: i.signatoryName ?? null,
  signatory_title: i.signatoryTitle ?? null,
  signature_path: i.signaturePath ?? null,
  number_prefix: i.numberPrefix,
  is_active: i.isActive,
});

// The company letterhead always has the logo (even when reports print without one)
const letterBrand = (companyId: number) => loadBrand(companyId, { letterhead: true });

async function getTemplate(companyId: number, id: number) {
  const [t] = await db.select().from(letterTemplates).where(and(eq(letterTemplates.company_id, companyId), eq(letterTemplates.id, id)));
  if (!t) throw new NotFoundError("Letter template not found");
  return t;
}

// ---- Templates ----

// Variables, letter types, and the company letterhead as the editor draws it
export async function variableCatalog(companyId: number) {
  const { company, settings } = await letterBrand(companyId);
  return {
    variables: VARIABLES,
    types: Object.entries(LETTER_LABEL).map(([value, label]) => ({ value, label, prefix: LETTER_PREFIX[value as LetterType] })),
    letterhead: {
      name: company.name,
      lines: [company.legalName, settings.showAddress ? company.address : null, settings.showContact ? company.contact : null, settings.showTaxIds ? company.taxIds : null].filter(Boolean),
      logoUrl: settings.showLogo ? company.logoUrl : null,
    },
  };
}

// Page 1 of an uploaded letterhead as an image (the editor's page background)
export async function letterheadImage(companyId: number, path: string) {
  checkTemplateFile(companyId, path);
  const png = await letterheadPng(path);
  if (!png) throw new NotFoundError("Couldn't show this letterhead — the PDF preview still uses it");
  return png;
}

export async function listTemplates(companyId: number) {
  const rows = await db
    .select({
      ...getTableColumns(letterTemplates),
      ...auditNames(letterTemplates),
      letters: sql<number>`(select count(*)::int from employee_letters l where l.template_id = "letter_templates"."id")`,
    })
    .from(letterTemplates)
    .where(eq(letterTemplates.company_id, companyId))
    .orderBy(asc(letterTemplates.type), asc(letterTemplates.name));
  return { templates: rows };
}

export async function templateDetail(companyId: number, id: number) {
  const [row] = await db
    .select({ ...getTableColumns(letterTemplates), ...auditNames(letterTemplates) })
    .from(letterTemplates)
    .where(and(eq(letterTemplates.company_id, companyId), eq(letterTemplates.id, id)));
  if (!row) throw new NotFoundError("Letter template not found");
  return { template: row };
}

// A ready-made body and fields for a new template of this type
export const starterTemplate = (type: LetterType) => ({ ...starterFor(type), title: LETTER_LABEL[type], numberPrefix: LETTER_PREFIX[type] });

export async function saveTemplate(companyId: number, actor: Express.AuthUser, id: number | null, input: TemplateInput) {
  checkTemplateFile(companyId, input.letterheadPath);
  checkTemplateFile(companyId, input.signaturePath);
  const row = templateRow(input);
  if (id) {
    const current = await getTemplate(companyId, id);
    // Letters already issued keep their own copy, so editing just starts a new version
    const [saved] = await db
      .update(letterTemplates)
      .set({ ...row, version: current.version + 1, ...stamp.updated(actor) })
      .where(eq(letterTemplates.id, id))
      .returning();
    audit(actor, { companyId, action: "letter.template.update", target: ["letter_template", id], summary: `Changed the letter template ${row.name} (v${saved!.version})` });
    return { template: saved };
  }
  const [saved] = await db
    .insert(letterTemplates)
    .values({ ...row, company_id: companyId, ...stamp.created(actor) })
    .returning();
  audit(actor, { companyId, action: "letter.template.create", target: ["letter_template", saved!.id], summary: `Added the letter template ${row.name}` });
  return { template: saved };
}

export async function deleteTemplate(companyId: number, actor: Express.AuthUser, id: number) {
  const t = await getTemplate(companyId, id);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(employeeLetters).where(eq(employeeLetters.template_id, id));
  if (n > 0) throw new BadRequestError(`${n} letter${n === 1 ? " was" : "s were"} made from this template — make it inactive instead`);
  await db.delete(letterTemplates).where(eq(letterTemplates.id, id));
  audit(actor, { companyId, action: "letter.template.delete", target: ["letter_template", id], summary: `Removed the letter template ${t.name}` });
}

export async function uploadTemplateFile(companyId: number, actor: Express.AuthUser, kind: "letterhead" | "signature", file: UploadedFile | undefined) {
  const stored = await storeFile(kind === "letterhead" ? "letterhead" : "letter-signature", { companyId, employeeId: actor.employeeId }, file);
  return { file: { path: stored.filePath, name: stored.fileName } };
}

// Sample data so a template can be previewed before any employee is picked
const SAMPLE: Record<string, string> = {
  employee_name: "Priya Sharma",
  employee_code: "EMP-001",
  employee_email: "priya@example.com",
  employee_phone: "+91 98765 43210",
  employee_address: "12 MG Road, Bengaluru, Karnataka 560001",
  designation: "Software Engineer",
  department: "Engineering",
  branch: "Head office",
  manager_name: "Rahul Verma",
  employment_type: "full time",
  joining_date: longDate(localDate()),
  probation_end_date: longDate(localDate()),
  confirmed_on: longDate(localDate()),
  last_working_day: longDate(localDate()),
  ctc_annual: "Rs. 6,00,000",
  ctc_annual_words: "Rupees Six Lakh only",
  ctc_monthly: "Rs. 50,000",
  basic_monthly: "Rs. 25,000",
  gross_monthly: "Rs. 50,000",
};
const SAMPLE_SALARY: SalaryRow[] = [
  { label: "Basic", monthly: 25000, annual: 300000 },
  { label: "HRA", monthly: 12500, annual: 150000 },
  { label: "Special allowance", monthly: 12500, annual: 150000 },
];

// The unsaved template as a PDF (with DRAFT across it)
export async function previewTemplate(companyId: number, input: TemplateInput, employeeId?: number) {
  checkTemplateFile(companyId, input.letterheadPath);
  checkTemplateFile(companyId, input.signaturePath);
  const brand = await letterBrand(companyId);
  const filled = employeeId ? await fillValues(companyId, employeeId) : null;
  const values = {
    ...(filled?.values ?? { ...SAMPLE, company_name: brand.company.name, company_address: brand.company.address ?? "", today: longDate(localDate()) }),
    letter_number: `${input.numberPrefix}/${localDate().slice(0, 4)}/0001`,
    signatory_name: input.signatoryName ?? "",
    signatory_title: input.signatoryTitle ?? "",
  };
  const row = templateRow(input);
  return renderLetter({
    snapshot: snapshotOf({ ...row, version: 0 } as TemplateRow),
    values,
    salaryRows: filled ? filled.salaryRows : SAMPLE_SALARY,
    brand,
    draft: true,
  });
}

// ---- Letters for an employee ----

const creator = alias(users, "letter_creator");
const issuer = alias(users, "letter_issuer");
const letterColumns = {
  id: employeeLetters.id,
  employee_id: employeeLetters.employee_id,
  employee_name: employees.name,
  employee_code: employees.employee_code,
  template_id: employeeLetters.template_id,
  type: employeeLetters.type,
  title: employeeLetters.title,
  code: employeeLetters.code,
  status: employeeLetters.status,
  values: employeeLetters.values,
  issued_at: employeeLetters.issued_at,
  issued_by_name: issuer.name,
  version: sql<number>`(${employeeLetters.snapshot} ->> 'version')::int`,
  created_at: employeeLetters.created_at,
  created_by_name: creator.name,
  updated_at: employeeLetters.updated_at,
  updated_by_name: sql<string | null>`(select u.name from users u where u.id = ${employeeLetters.updated_by})`,
};
const selectLetters = () =>
  db
    .select(letterColumns)
    .from(employeeLetters)
    .innerJoin(employees, eq(employees.id, employeeLetters.employee_id))
    .leftJoin(creator, eq(creator.id, employeeLetters.created_by))
    .leftJoin(issuer, eq(issuer.id, employeeLetters.issued_by));

async function getLetter(companyId: number, id: number) {
  const [l] = await db.select().from(employeeLetters).where(and(eq(employeeLetters.company_id, companyId), eq(employeeLetters.id, id)));
  if (!l) throw new NotFoundError("Letter not found");
  return l;
}

// The generate form: everything filled from records + the template's own fields, and what's still empty
export async function letterForm(companyId: number, employeeId: number, templateId: number) {
  const t = await getTemplate(companyId, templateId);
  if (!t.is_active) throw new BadRequestError("This template is inactive");
  const { values } = await fillValues(companyId, employeeId);
  const used = variablesIn(t.body);
  const auto = [...used].filter((k) => VARIABLES.some((v) => v.key === k && !v.block) && !["letter_number", "signatory_name", "signatory_title"].includes(k));
  return {
    template: { id: t.id, name: t.name, type: t.type, title: t.title ?? LETTER_LABEL[t.type as LetterType], version: t.version },
    // Known values the letter uses (HR can change them for this letter)
    auto: auto.map((key) => ({ key, label: VARIABLES.find((v) => v.key === key)!.label, value: values[key] ?? "" })),
    fields: t.fields,
    missing: auto.filter((k) => !values[k]),
  };
}

// Letters already made for the employee + letters worth making now (from their record)
export async function employeeLetterList(companyId: number, employeeId: number) {
  const e = await getEmployeeById(companyId, employeeId);
  const [letters, templates] = await Promise.all([
    selectLetters()
      .where(and(eq(employeeLetters.company_id, companyId), eq(employeeLetters.employee_id, employeeId)))
      .orderBy(desc(employeeLetters.created_at)),
    db
      .select({ id: letterTemplates.id, name: letterTemplates.name, type: letterTemplates.type })
      .from(letterTemplates)
      .where(and(eq(letterTemplates.company_id, companyId), eq(letterTemplates.is_active, true)))
      .orderBy(asc(letterTemplates.name)),
  ]);
  const has = (type: LetterType) => letters.some((l) => l.type === type && l.status === "issued");
  const want: { type: LetterType; reason: string }[] = [];
  if (e.probation_status === "confirmed" && !has("probation_confirmation")) want.push({ type: "probation_confirmation", reason: "Probation confirmed" });
  if (e.probation_status === "extended" && !has("probation_extension")) want.push({ type: "probation_extension", reason: "Probation extended" });
  if (e.status === "exited" && !has("experience")) want.push({ type: "experience", reason: "Has left the company" });
  if ((e.status === "exited" || e.status === "notice") && !has("relieving")) want.push({ type: "relieving", reason: e.status === "notice" ? "Serving notice" : "Has left the company" });
  if (e.join_date && e.join_date >= localDate().slice(0, 4) && !has("appointment") && !has("offer")) want.push({ type: "appointment", reason: "Joined recently" });
  const suggestions = want
    .map((w) => ({ ...w, label: LETTER_LABEL[w.type], template: templates.find((t) => t.type === w.type) ?? null }))
    .filter((s) => s.template);
  return { letters, templates, suggestions };
}

// Final values for printing: the record, the HR's edits, and the letter's own details
async function finalValues(companyId: number, employeeId: number, t: TemplateRow, edits: Record<string, string>, letterNumber: string) {
  const { values, salaryRows } = await fillValues(companyId, employeeId);
  const fieldKeys = new Set(t.fields.map((f) => f.key));
  const allowed = Object.fromEntries(Object.entries(edits).filter(([k]) => fieldKeys.has(k) || VARIABLES.some((v) => v.key === k)));
  // Dates typed in fields (YYYY-MM-DD) print as "1 December 2026"
  for (const f of t.fields) if (f.type === "date" && allowed[f.key] && /^\d{4}-\d{2}-\d{2}$/.test(allowed[f.key]!)) allowed[f.key] = longDate(allowed[f.key]!);
  return {
    values: { ...values, ...allowed, letter_number: letterNumber, signatory_name: t.signatory_name ?? "", signatory_title: t.signatory_title ?? "" },
    salaryRows,
  };
}

function checkRequired(t: TemplateRow, edits: Record<string, string>) {
  const missing = t.fields.filter((f) => f.required && !edits[f.key]?.trim()).map((f) => f.label);
  if (missing.length) throw new BadRequestError(`Fill in: ${missing.join(", ")}`);
}

// Next number for this company, prefix and year: OFR/2026/0012
async function nextNumber(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], companyId: number, t: TemplateRow) {
  await tx.execute(sql`select pg_advisory_xact_lock(${companyId}, 7301)`);
  const year = localDate().slice(0, 4);
  const [{ n }] = await tx
    .select({ n: sql<number>`coalesce(max(${employeeLetters.number}), 0)::int` })
    .from(employeeLetters)
    .where(and(eq(employeeLetters.company_id, companyId), eq(employeeLetters.type, t.type), sql`${employeeLetters.code} like ${`${t.number_prefix}/${year}/%`}`));
  const number = n + 1;
  return { number, code: `${t.number_prefix}/${year}/${String(number).padStart(4, "0")}` };
}

// Save a draft, or issue: number it, print it over the letterhead, keep the PDF and tell the employee
export async function saveLetter(companyId: number, actor: Express.AuthUser, employeeId: number, letterId: number | null, input: LetterInput) {
  const employee = await getEmployeeById(companyId, employeeId);
  const t = await getTemplate(companyId, input.templateId);
  if (!t.is_active && !letterId) throw new BadRequestError("This template is inactive");
  if (letterId) {
    const current = await getLetter(companyId, letterId);
    if (current.employee_id !== employeeId) throw new NotFoundError("Letter not found");
    if (current.status === "issued") throw new BadRequestError("An issued letter can't be changed — make a new one");
  }
  if (input.issue) checkRequired(t, input.values);
  const title = t.title ?? LETTER_LABEL[t.type as LetterType];
  const snapshot = snapshotOf(t);

  const saved = await db.transaction(async (tx) => {
    const numbered = input.issue ? await nextNumber(tx, companyId, t) : null;
    const base = { template_id: t.id, type: t.type, title, values: input.values, snapshot, ...stamp.updated(actor) };
    const [row] = letterId
      ? await tx
          .update(employeeLetters)
          .set({ ...base, ...(numbered ? { number: numbered.number, code: numbered.code } : {}) })
          .where(eq(employeeLetters.id, letterId))
          .returning()
      : await tx
          .insert(employeeLetters)
          .values({ ...base, company_id: companyId, employee_id: employeeId, ...(numbered ? { number: numbered.number, code: numbered.code } : {}), ...stamp.created(actor) })
          .returning();
    return row!;
  });

  if (!input.issue) return { letter: { id: saved.id, status: saved.status } };

  // Print and keep the issued PDF
  const { values, salaryRows } = await finalValues(companyId, employeeId, t, input.values, saved.code!);
  const pdf = await renderLetter({ snapshot, values, salaryRows, brand: await letterBrand(companyId) });
  const stored = await storeFile("employee-letter", { companyId, employeeId }, { buffer: pdf, originalname: `${saved.code!.replace(/\//g, "-")}.pdf`, mimetype: "application/pdf", size: pdf.length });
  await db
    .update(employeeLetters)
    .set({ status: "issued", pdf_path: stored.filePath, values: { ...input.values, ...Object.fromEntries(Object.entries(values).filter(([k]) => t.fields.some((f) => f.key === k))) }, issued_at: new Date(), issued_by: actor.id, ...stamp.updated(actor) })
    .where(eq(employeeLetters.id, saved.id));
  void notify({ companyId, to: [{ employeeId }], type: "letter.issued", title: `Your ${title.toLowerCase()} is ready`, body: saved.code ?? undefined, link: "/my-letters", entity: ["letter", saved.id], actorId: actor.id });
  audit(actor, { companyId, action: "letter.issued", target: ["employee", employeeId], summary: `Issued ${saved.code} (${title}) to ${employee.name}` });
  return { letter: { id: saved.id, status: "issued", code: saved.code } };
}

// The PDF: the stored file when issued, otherwise printed now with DRAFT across it
export async function letterPdf(companyId: number, id: number) {
  const l = await getLetter(companyId, id);
  if (l.status === "issued" && l.pdf_path) {
    const file = await fetchPrivateFile(l.pdf_path);
    if (file) return { pdf: file, fileName: `${(l.code ?? "letter").replace(/\//g, "-")}.pdf` };
  }
  const [t] = l.template_id ? await db.select().from(letterTemplates).where(eq(letterTemplates.id, l.template_id)) : [];
  const fields = t?.fields ?? [];
  const { values, salaryRows } = await fillValues(companyId, l.employee_id);
  for (const f of fields) if (f.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(l.values[f.key] ?? "")) l.values[f.key] = longDate(l.values[f.key]!);
  const pdf = await renderLetter({
    snapshot: l.snapshot,
    values: { ...values, ...l.values, letter_number: l.code ?? "(number on issue)", signatory_name: l.snapshot.signatory_name ?? "", signatory_title: l.snapshot.signatory_title ?? "" },
    salaryRows,
    brand: await letterBrand(companyId),
    draft: l.status !== "issued",
  });
  return { pdf, fileName: `${l.title.replace(/[^a-z0-9]+/gi, "-")}-draft.pdf` };
}

// Preview of a letter before saving: the template filled for this employee with the HR's edits
export async function previewLetter(companyId: number, employeeId: number, input: LetterInput) {
  const t = await getTemplate(companyId, input.templateId);
  const { values, salaryRows } = await finalValues(companyId, employeeId, t, input.values, "(number on issue)");
  return renderLetter({ snapshot: snapshotOf(t), values, salaryRows, brand: await letterBrand(companyId), draft: true });
}

export async function deleteLetter(companyId: number, actor: Express.AuthUser, id: number) {
  const l = await getLetter(companyId, id);
  if (l.status === "issued") throw new BadRequestError("Issued letters stay on record — only drafts can be deleted");
  await db.delete(employeeLetters).where(eq(employeeLetters.id, id));
  audit(actor, { companyId, action: "letter.draft.delete", target: ["employee", l.employee_id], summary: `Deleted a draft ${l.title}` });
}

// ---- Register: every letter in the company ----

export async function letterRegister(companyId: number, q: RegisterQuery) {
  const where = and(
    eq(employeeLetters.company_id, companyId),
    q.type ? eq(employeeLetters.type, q.type) : undefined,
    q.status ? eq(employeeLetters.status, q.status) : undefined,
    q.employeeId ? eq(employeeLetters.employee_id, q.employeeId) : undefined,
    q.q ? or(ilike(employees.name, `%${q.q}%`), ilike(employeeLetters.code, `%${q.q}%`), ilike(employees.employee_code, `%${q.q}%`)) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    selectLetters()
      .where(where)
      .orderBy(desc(employeeLetters.created_at), desc(employeeLetters.id))
      .limit(q.limit)
      .offset((q.page - 1) * q.limit),
    db.select({ total: sql<number>`count(*)::int` }).from(employeeLetters).innerJoin(employees, eq(employees.id, employeeLetters.employee_id)).where(where),
  ]);
  return { rows, total, page: q.page, limit: q.limit };
}

// ---- The employee's own issued letters ----

export async function myLetters(companyId: number, actor: Express.AuthUser) {
  if (!actor.employeeId) return { letters: [] };
  const rows = await selectLetters()
    .where(and(eq(employeeLetters.company_id, companyId), eq(employeeLetters.employee_id, actor.employeeId), eq(employeeLetters.status, "issued")))
    .orderBy(desc(employeeLetters.issued_at));
  return { letters: rows.map(({ values: _v, ...r }) => r) };
}

export async function myLetterPdf(companyId: number, actor: Express.AuthUser, id: number) {
  const l = await getLetter(companyId, id);
  if (l.employee_id !== actor.employeeId || l.status !== "issued") throw new ForbiddenError("You can open only your own letters");
  return letterPdf(companyId, id);
}

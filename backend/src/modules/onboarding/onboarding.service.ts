// Self-onboarding: HR shares a link, the employee fills in their own details and uploads documents
import crypto from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../../config/db.js";
import { companies, employeeDocuments, employees, onboardingLinks } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors.js";
import { appUrl } from "../mail/layout.js";
import { sendTemplate } from "../mail/mail.service.js";
import { hrRecipients, notify } from "../notifications/notify.js";
import { uploadDocument } from "../employees/employeeDocuments.service.js";
import { getPrivate, mergePrivate } from "../employees/employeePrivate.service.js";
import { getEmployeeById } from "../employees/employees.service.js";
import type { DocumentInput } from "../employees/employees.schema.js";
import type { UploadedFile } from "../upload/upload.service.js";
import type { OnboardingDetailsInput } from "./onboarding.schema.js";

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const joinLink = (token: string) => appUrl(`/join/${token}`);

// ---- HR side ----

// Latest link for an employee (no token — it's never stored)
export async function linkStatus(companyId: number, employeeId: number) {
  await getEmployeeById(companyId, employeeId);
  const [row] = await db
    .select({ id: onboardingLinks.id, expires_at: onboardingLinks.expires_at, submitted_at: onboardingLinks.submitted_at, revoked_at: onboardingLinks.revoked_at, created_at: onboardingLinks.created_at })
    .from(onboardingLinks)
    .where(and(eq(onboardingLinks.company_id, companyId), eq(onboardingLinks.employee_id, employeeId)))
    .orderBy(desc(onboardingLinks.id))
    .limit(1);
  return { link: row ?? null };
}

// New link (older open ones stop working); optionally emailed to the employee
export async function createLink(companyId: number, actor: Express.AuthUser, employeeId: number, { hours, sendEmail }: { hours: number; sendEmail: boolean }) {
  const employee = await getEmployeeById(companyId, employeeId);
  if (employee.status === "exited") throw new BadRequestError(`${employee.name} has left the company`);
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + hours * 3600 * 1000);
  await db.transaction(async (tx) => {
    await tx
      .update(onboardingLinks)
      .set({ revoked_at: new Date() })
      .where(and(eq(onboardingLinks.employee_id, employeeId), isNull(onboardingLinks.submitted_at), isNull(onboardingLinks.revoked_at)));
    await tx.insert(onboardingLinks).values({ company_id: companyId, employee_id: employeeId, token_hash: hash(token), expires_at: expiresAt, created_by: actor.id });
  });
  const url = joinLink(token);
  const to = employee.personal_email || employee.email;
  if (sendEmail && to) {
    const [company] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId));
    void sendTemplate(to, "onboardingLink", { name: employee.name, companyName: company?.name ?? "your new company", link: url, expiresAt });
  }
  audit(actor, { companyId, action: "onboarding.link_created", target: ["employee", employeeId], summary: `Created a ${hours}-hour onboarding link for ${employee.name}${sendEmail && to ? ` (emailed to ${to})` : ""}` });
  return { url, expiresAt, emailedTo: sendEmail ? (to ?? null) : null };
}

export async function revokeLink(companyId: number, actor: Express.AuthUser, employeeId: number) {
  const employee = await getEmployeeById(companyId, employeeId);
  await db
    .update(onboardingLinks)
    .set({ revoked_at: new Date() })
    .where(and(eq(onboardingLinks.company_id, companyId), eq(onboardingLinks.employee_id, employeeId), isNull(onboardingLinks.submitted_at), isNull(onboardingLinks.revoked_at)));
  audit(actor, { companyId, action: "onboarding.link_revoked", target: ["employee", employeeId], summary: `Stopped the onboarding link of ${employee.name}` });
}

// ---- Employee side (public, by token) ----

async function openLink(token: string) {
  const [row] = await db
    .select()
    .from(onboardingLinks)
    .where(and(eq(onboardingLinks.token_hash, hash(token)), isNull(onboardingLinks.revoked_at), gt(onboardingLinks.expires_at, new Date())));
  if (!row) throw new NotFoundError("This link has expired or was replaced — ask HR for a new one");
  if (row.submitted_at) throw new BadRequestError("You've already submitted your details — HR will contact you if anything else is needed");
  return row;
}

const PRIVATE_KEYS = ["pan", "aadhaar", "uan", "pf_number", "esi_number", "passport_number", "bank_name", "bank_branch", "ifsc", "account_number", "account_holder", "account_type"] as const;

// GET /api/onboarding/:token → the form (ID / bank values aren't sent back, only whether they're on file)
export async function openForm(token: string) {
  const link = await openLink(token);
  const e = await getEmployeeById(link.company_id, link.employee_id);
  const [company] = await db.select({ name: companies.name, logo_url: companies.logo_url }).from(companies).where(eq(companies.id, link.company_id));
  const priv = await getPrivate(link.company_id, link.employee_id);
  const docs = await db
    .select({ id: employeeDocuments.id, name: employeeDocuments.name, category: employeeDocuments.category, file_name: employeeDocuments.file_name, created_at: employeeDocuments.created_at })
    .from(employeeDocuments)
    .where(and(eq(employeeDocuments.company_id, link.company_id), eq(employeeDocuments.employee_id, link.employee_id)))
    .orderBy(desc(employeeDocuments.created_at));
  return {
    company: company ?? null,
    expiresAt: link.expires_at,
    employee: { name: e.name, email: e.email, designation: e.designation, department: e.department, join_date: e.join_date, employee_code: e.employee_code },
    details: {
      phone: e.phone,
      personalEmail: e.personal_email,
      dateOfBirth: e.date_of_birth,
      gender: e.gender,
      maritalStatus: e.marital_status,
      bloodGroup: e.blood_group,
      nationality: e.nationality,
      address: e.address,
      addressLine2: e.address_line2,
      city: e.city,
      state: e.state,
      postalCode: e.postal_code,
      country: e.country,
      emergencyContactName: e.emergency_contact_name,
      emergencyContactPhone: e.emergency_contact_phone,
      emergencyContactRelation: e.emergency_contact_relation,
    },
    privateOnFile: Object.fromEntries(PRIVATE_KEYS.map((k) => [k, Boolean(priv?.[k])])),
    documents: docs,
  };
}

// PUT /api/onboarding/:token — save (can be done many times until submit)
export async function saveForm(token: string, input: OnboardingDetailsInput) {
  const link = await openLink(token);
  const { private: priv, ...d } = input;
  const set: Partial<typeof employees.$inferInsert> = {};
  const put = <K extends keyof typeof employees.$inferInsert>(col: K, v: unknown) => {
    if (v !== undefined) set[col] = ((typeof v === "string" ? v.trim() : v) || null) as (typeof employees.$inferInsert)[K];
  };
  // Only the fields sent (undefined = not in the request)
  put("phone", d.phone);
  put("personal_email", d.personalEmail);
  put("date_of_birth", d.dateOfBirth);
  put("gender", d.gender);
  put("marital_status", d.maritalStatus);
  put("blood_group", d.bloodGroup);
  put("nationality", d.nationality);
  put("address", d.address);
  put("address_line2", d.addressLine2);
  put("city", d.city);
  put("state", d.state);
  put("postal_code", d.postalCode);
  put("country", d.country);
  put("emergency_contact_name", d.emergencyContactName);
  put("emergency_contact_phone", d.emergencyContactPhone);
  put("emergency_contact_relation", d.emergencyContactRelation);
  if (Object.keys(set).length) await db.update(employees).set(set).where(and(eq(employees.company_id, link.company_id), eq(employees.id, link.employee_id)));
  if (priv) await mergePrivate(link.company_id, link.employee_id, priv);
  return { saved: true };
}

// POST /api/onboarding/:token/documents (multipart: file, category, name?)
export async function uploadOwnDocument(token: string, file: UploadedFile | undefined, input: DocumentInput) {
  const link = await openLink(token);
  return uploadDocument(link.company_id, null, link.employee_id, file, input);
}

// POST /api/onboarding/:token/submit — locks the link and tells HR
export async function submitForm(token: string) {
  const link = await openLink(token);
  await db.update(onboardingLinks).set({ submitted_at: new Date() }).where(eq(onboardingLinks.id, link.id));
  const e = await getEmployeeById(link.company_id, link.employee_id);
  const to = await hrRecipients(link.company_id);
  if (link.created_by) to.push({ userId: link.created_by });
  await notify({
    companyId: link.company_id,
    to,
    type: "onboarding.submitted",
    title: `${e.name} filled in their joining details`,
    body: "Review their details and documents on their profile.",
    link: `/employees/${e.id}`,
    entity: ["employee", e.id],
  });
  audit(null, { companyId: link.company_id, action: "onboarding.submitted", target: ["employee", e.id], summary: `${e.name} submitted their onboarding form` });
  return { submitted: true };
}

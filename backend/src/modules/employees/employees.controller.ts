import { and, desc, eq } from "drizzle-orm";
import { db } from "../../config/db.js";
import { auditLogs, companies, employees, users } from "../../db/schema.js";
import {
  CODE_FORMATS,
  defaultPrefix,
  nextCode,
  type CodeFormat,
} from "../../utils/employeeCode.js";
import { localDate } from "../../utils/workday.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import {
  createEmployeeWithLogin,
  updateEmployeeWithLogin,
} from "./employeeAccount.service.js";
import {
  deleteAllDocumentFiles,
  deleteDocument,
  documentLink,
  listDocuments,
  uploadDocument,
} from "./employeeDocuments.service.js";
import { cancelExit, rehire, startExit } from "./employeeExit.service.js";
import { getPrivate } from "./employeePrivate.service.js";
import {
  deleteEmployee,
  getEmployeeById,
  listEmployees,
} from "./employees.service.js";

// GET /api/employees
export const listEmployeesHandler = asyncHandler(async (req, res) => {
  res.json(await listEmployees(tenant(req).companyId));
});

// POST /api/employees
export const createEmployeeHandler = asyncHandler(async (req, res) => {
  res
    .status(HttpStatus.CREATED)
    .json(
      await createEmployeeWithLogin(
        tenant(req).companyId,
        currentUser(req),
        req.body,
      ),
    );
});

// PUT /api/employees/:id
export const updateEmployeeHandler = asyncHandler(async (req, res) => {
  res.json(
    await updateEmployeeWithLogin(
      tenant(req).companyId,
      currentUser(req),
      Number(req.params.id),
      req.body,
    ),
  );
});

// DELETE /api/employees/:id
export const deleteEmployeeHandler = asyncHandler(async (req, res) => {
  const { companyId } = tenant(req);
  const id = Number(req.params.id);
  await getEmployeeById(companyId, id); // 404 before touching any files
  await deleteAllDocumentFiles(companyId, id);
  await deleteEmployee(companyId, currentUser(req), id);
  res.json({ success: true });
});

// GET /api/employees/:id
export const getEmployeeHandler = asyncHandler(async (req, res) => {
  res.json({
    employee: await getEmployeeById(
      tenant(req).companyId,
      Number(req.params.id),
    ),
  });
});

// POST /api/employees/:id/exit  { lastWorkingDay, reason, notes? }
export const exitHandler = asyncHandler(async (req, res) => {
  res.json(
    await startExit(
      tenant(req).companyId,
      currentUser(req),
      Number(req.params.id),
      req.body,
    ),
  );
});

// POST /api/employees/:id/cancel-exit
export const cancelExitHandler = asyncHandler(async (req, res) => {
  res.json(
    await cancelExit(
      tenant(req).companyId,
      currentUser(req),
      Number(req.params.id),
    ),
  );
});

// POST /api/employees/:id/rehire
export const rehireHandler = asyncHandler(async (req, res) => {
  res.json(
    await rehire(
      tenant(req).companyId,
      currentUser(req),
      Number(req.params.id),
    ),
  );
});

// GET /api/employees/:id/documents
export const listDocumentsHandler = asyncHandler(async (req, res) => {
  res.json(await listDocuments(tenant(req).companyId, Number(req.params.id)));
});

// POST /api/employees/:id/documents  (multipart: file, name?, category)
export const uploadDocumentHandler = asyncHandler(async (req, res) => {
  res
    .status(HttpStatus.CREATED)
    .json(
      await uploadDocument(
        tenant(req).companyId,
        currentUser(req),
        Number(req.params.id),
        req.file,
        req.body,
      ),
    );
});

// GET /api/employees/:id/documents/:docId/link → { url } valid for a few minutes
export const documentLinkHandler = asyncHandler(async (req, res) => {
  res.json(
    await documentLink(
      tenant(req).companyId,
      Number(req.params.id),
      Number(req.params.docId),
    ),
  );
});

// DELETE /api/employees/:id/documents/:docId
export const deleteDocumentHandler = asyncHandler(async (req, res) => {
  await deleteDocument(
    tenant(req).companyId,
    currentUser(req),
    Number(req.params.id),
    Number(req.params.docId),
  );
  res.json({ success: true });
});

// GET /api/employees/:id/private → statutory IDs + bank (HR / Admin)
export const privateHandler = asyncHandler(async (req, res) => {
  const { companyId } = tenant(req);
  await getEmployeeById(companyId, Number(req.params.id));
  res.json({ private: await getPrivate(companyId, Number(req.params.id)) });
});

// GET /api/employees/ifsc/:code → bank and branch for an IFSC (Razorpay's free IFSC directory)
export const ifscHandler = asyncHandler(async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code))
    throw new BadRequestError("IFSC looks like SBIN0001234");
  const r = await fetch(`https://ifsc.razorpay.com/${code}`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!r)
    throw new BadRequestError(
      "Couldn't reach the IFSC directory — fill the bank details by hand",
    );
  if (r.status === 404)
    throw new NotFoundError("No bank branch found for this IFSC");
  const d = (await r.json()) as {
    BANK?: string;
    BRANCH?: string;
    CITY?: string;
    STATE?: string;
    ADDRESS?: string;
  };
  res.json({
    ifsc: code,
    bank: d.BANK ?? null,
    branch: d.BRANCH ?? null,
    city: d.CITY ?? null,
    state: d.STATE ?? null,
    address: d.ADDRESS ?? null,
  });
});

// GET /api/employees/:id/timeline → what happened on their record (audit log), newest first
export const timelineHandler = asyncHandler(async (req, res) => {
  const { companyId } = tenant(req);
  const id = Number(req.params.id);
  await getEmployeeById(companyId, id);
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      summary: auditLogs.summary,
      actor: users.name,
      created_at: auditLogs.created_at,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actor_id))
    .where(
      and(
        eq(auditLogs.company_id, companyId),
        eq(auditLogs.target_type, "employee"),
        eq(auditLogs.target_id, id),
      ),
    )
    .orderBy(desc(auditLogs.id))
    .limit(100);
  res.json({ events: rows });
});

// GET /api/employees/next-code → the next free code in the company's format (prefilled in Add employee)
export const nextCodeHandler = asyncHandler(async (req, res) => {
  const { companyId } = tenant(req);
  const [company] = await db
    .select({
      name: companies.name,
      prefix: companies.employee_id_prefix,
      format: companies.employee_code_format,
      digits: companies.employee_code_digits,
    })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!company) throw new NotFoundError("Company not found");

  const rows = await db
    .select({ code: employees.employee_code })
    .from(employees)
    .where(eq(employees.company_id, companyId));

  const prefix = company.prefix || defaultPrefix(company.name);

  const format = (
    company.format in CODE_FORMATS ? company.format : "prefix_seq"
  ) as CodeFormat;

  const year = Number(localDate().slice(0, 4));
  res.json({
    code: nextCode(
      rows.map((r) => r.code),
      prefix,
      format,
      company.digits,
      year,
    ),
    prefix,
    format,
  });
});

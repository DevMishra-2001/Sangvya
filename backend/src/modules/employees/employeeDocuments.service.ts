// Documents on an employee's record.
import { and, desc, eq } from "drizzle-orm";
import { env } from "../../config/env.js";
import { db } from "../../config/db.js";
import { getImageKit } from "../../config/imagekit.js";
import { employeeDocuments, users } from "../../db/schema.js";
import { audit } from "../../utils/audit.js";
import { BadRequestError, NotFoundError } from "../../utils/httpErrors.js";
import type { DocumentInput } from "./employees.schema.js";
import { getEmployeeById } from "./employees.service.js";

export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
const LINK_SECONDS = 5 * 60;

const columns = {
  id: employeeDocuments.id,
  employee_id: employeeDocuments.employee_id,
  name: employeeDocuments.name,
  category: employeeDocuments.category,
  file_name: employeeDocuments.file_name,
  mime_type: employeeDocuments.mime_type,
  size_bytes: employeeDocuments.size_bytes,
  uploaded_by_name: users.name,
  created_at: employeeDocuments.created_at,
};

export async function listDocuments(companyId: number, employeeId: number) {
  await getEmployeeById(companyId, employeeId);
  const rows = await db
    .select(columns)
    .from(employeeDocuments)
    .leftJoin(users, eq(users.id, employeeDocuments.uploaded_by))
    .where(and(eq(employeeDocuments.company_id, companyId), eq(employeeDocuments.employee_id, employeeId)))
    .orderBy(desc(employeeDocuments.created_at));
  return { documents: rows };
}

async function findDocument(companyId: number, employeeId: number, id: number) {
  const [doc] = await db
    .select()
    .from(employeeDocuments)
    .where(and(eq(employeeDocuments.company_id, companyId), eq(employeeDocuments.employee_id, employeeId), eq(employeeDocuments.id, id)));
  if (!doc) throw new NotFoundError("Document not found");
  return doc;
}

export async function uploadDocument(
  companyId: number,
  actor: Express.AuthUser,
  employeeId: number,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
  input: DocumentInput,
) {
  if (!file?.buffer?.length) throw new BadRequestError("Choose a file to upload");
  const employee = await getEmployeeById(companyId, employeeId);

  const ext = file.originalname.match(/\.[a-z0-9]{1,6}$/i)?.[0]?.toLowerCase() ?? "";
  const base = file.originalname.toLowerCase().replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "document";
  const result = await getImageKit().upload({
    file: file.buffer,
    fileName: `${base}${ext}`,
    folder: `${env.IMAGEKIT_FOLDER}/companies/${companyId}/documents/${employeeId}`,
    useUniqueFileName: true,
    isPrivateFile: true,
  });

  const [row] = await db
    .insert(employeeDocuments)
    .values({
      company_id: companyId,
      employee_id: employeeId,
      name: input.name || file.originalname.replace(/\.[^/.]+$/, "").slice(0, 150),
      category: input.category,
      file_id: result.fileId,
      file_path: result.filePath,
      file_name: file.originalname.slice(0, 255),
      mime_type: file.mimetype,
      size_bytes: file.size,
      uploaded_by: actor.id,
    })
    .returning({ id: employeeDocuments.id });
  audit(actor, { companyId, action: "document.uploaded", target: ["employee", employeeId], summary: `Uploaded "${input.name || file.originalname}" for ${employee.name}` });
  const [doc] = await db
    .select(columns)
    .from(employeeDocuments)
    .leftJoin(users, eq(users.id, employeeDocuments.uploaded_by))
    .where(eq(employeeDocuments.id, row.id));
  return { document: doc };
}

// GET …/documents/:docId/link → a signed link valid for a few minutes
export async function documentLink(companyId: number, employeeId: number, id: number) {
  const doc = await findDocument(companyId, employeeId, id);
  const url = getImageKit().url({ path: doc.file_path, signed: true, expireSeconds: LINK_SECONDS });
  return { url, fileName: doc.file_name, expiresInSeconds: LINK_SECONDS };
}

// Delete the file and clear ImageKit's CDN cache, so links already handed out stop working
async function removeFile(fileId: string, filePath: string) {
  const ik = getImageKit();
  try {
    await ik.deleteFile(fileId);
  } catch (err) {
    // Already gone from ImageKit (or it's unreachable) — still remove our record
    console.error(`Deleting ImageKit file ${fileId} failed:`, (err as Error).message);
  }
  try {
    await ik.purgeCache(ik.url({ path: filePath }));
  } catch (err) {
    console.error(`Clearing the cache for ${filePath} failed:`, (err as Error).message);
  }
}

export async function deleteDocument(companyId: number, actor: Express.AuthUser, employeeId: number, id: number) {
  const doc = await findDocument(companyId, employeeId, id);
  const employee = await getEmployeeById(companyId, employeeId);
  await removeFile(doc.file_id, doc.file_path);
  await db.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
  audit(actor, { companyId, action: "document.removed", target: ["employee", employeeId], summary: `Removed "${doc.name}" from ${employee.name}'s documents` });
}

// Before an employee is deleted: remove their files from ImageKit too (the rows go with the employee)
export async function deleteAllDocumentFiles(companyId: number, employeeId: number) {
  const docs = await db
    .select({ file_id: employeeDocuments.file_id, file_path: employeeDocuments.file_path })
    .from(employeeDocuments)
    .where(and(eq(employeeDocuments.company_id, companyId), eq(employeeDocuments.employee_id, employeeId)));
  for (const { file_id, file_path } of docs) await removeFile(file_id, file_path);
}

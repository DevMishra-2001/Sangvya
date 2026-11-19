import type { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpStatus } from "../../utils/httpStatus.js";
import { currentUser, tenant } from "../../utils/requestContext.js";
import type { LetterType } from "../../db/schema.js";
import type { LetterheadQuery, LetterInput, RegisterQuery, TemplateInput } from "./letters.schema.js";
import {
  deleteLetter,
  deleteTemplate,
  employeeLetterList,
  letterForm,
  letterheadImage,
  letterPdf,
  letterRegister,
  listTemplates,
  myLetterPdf,
  myLetters,
  previewLetter,
  previewTemplate,
  saveLetter,
  saveTemplate,
  starterTemplate,
  templateDetail,
  uploadTemplateFile,
  variableCatalog,
} from "./letters.service.js";

const cid = (req: Parameters<typeof tenant>[0]) => tenant(req).companyId;
const num = (v: unknown) => Number(v);

// PDFs go back as a file the browser can show or save
function sendPdf(res: Response, pdf: Buffer, fileName: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  res.end(pdf);
}

// ---- Templates ----

// GET /api/letters/variables
export const variablesHandler = asyncHandler(async (req, res) => res.json(await variableCatalog(cid(req))));

// GET /api/letters/templates/letterhead?path=
export const letterheadImageHandler = asyncHandler(async (req, res) => {
  const { path } = req.query as unknown as LetterheadQuery;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "private, max-age=600");
  res.send(await letterheadImage(cid(req), path));
});
// GET /api/letters/templates
export const listTemplatesHandler = asyncHandler(async (req, res) => res.json(await listTemplates(cid(req))));
// GET /api/letters/templates/starter?type=
export const starterHandler = asyncHandler(async (req, res) => res.json(starterTemplate((req.query as unknown as { type: LetterType }).type)));
// GET /api/letters/templates/:id
export const templateDetailHandler = asyncHandler(async (req, res) => res.json(await templateDetail(cid(req), num(req.params.id))));
// POST /api/letters/templates
export const createTemplateHandler = asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await saveTemplate(cid(req), currentUser(req), null, req.body as TemplateInput)));
// PUT /api/letters/templates/:id
export const updateTemplateHandler = asyncHandler(async (req, res) => res.json(await saveTemplate(cid(req), currentUser(req), num(req.params.id), req.body as TemplateInput)));
// DELETE /api/letters/templates/:id
export const deleteTemplateHandler = asyncHandler(async (req, res) => {
  await deleteTemplate(cid(req), currentUser(req), num(req.params.id));
  res.json({ success: true });
});
// POST /api/letters/templates/preview  { template, employeeId? } → PDF
export const previewTemplateHandler = asyncHandler(async (req, res) => {
  const { template, employeeId } = req.body as { template: TemplateInput; employeeId?: number };
  sendPdf(res, await previewTemplate(cid(req), template, employeeId), "preview.pdf");
});
// POST /api/letters/files?kind=letterhead|signature
export const uploadFileHandler = asyncHandler(async (req, res) =>
  res.status(HttpStatus.CREATED).json(await uploadTemplateFile(cid(req), currentUser(req), (req.query as unknown as { kind: "letterhead" | "signature" }).kind, req.file)),
);

// ---- Letters for an employee ----

// GET /api/letters/employees/:employeeId
export const employeeLettersHandler = asyncHandler(async (req, res) => res.json(await employeeLetterList(cid(req), num(req.params.employeeId))));
// GET /api/letters/employees/:employeeId/form?templateId=
export const letterFormHandler = asyncHandler(async (req, res) => res.json(await letterForm(cid(req), num(req.params.employeeId), num((req.query as unknown as { templateId: number }).templateId))));
// POST /api/letters/employees/:employeeId/preview → PDF
export const previewLetterHandler = asyncHandler(async (req, res) => sendPdf(res, await previewLetter(cid(req), num(req.params.employeeId), req.body as LetterInput), "preview.pdf"));
// POST /api/letters/employees/:employeeId  { templateId, values, issue }
export const createLetterHandler = asyncHandler(async (req, res) => res.status(HttpStatus.CREATED).json(await saveLetter(cid(req), currentUser(req), num(req.params.employeeId), null, req.body as LetterInput)));
// PUT /api/letters/employees/:employeeId/:id  (drafts only)
export const updateLetterHandler = asyncHandler(async (req, res) => res.json(await saveLetter(cid(req), currentUser(req), num(req.params.employeeId), num(req.params.id), req.body as LetterInput)));

// ---- One letter, the register ----

// GET /api/letters/:id/pdf
export const letterPdfHandler = asyncHandler(async (req, res) => {
  const { pdf, fileName } = await letterPdf(cid(req), num(req.params.id));
  sendPdf(res, pdf, fileName);
});
// DELETE /api/letters/:id  (drafts only)
export const deleteLetterHandler = asyncHandler(async (req, res) => {
  await deleteLetter(cid(req), currentUser(req), num(req.params.id));
  res.json({ success: true });
});
// GET /api/letters
export const registerHandler = asyncHandler(async (req, res) => res.json(await letterRegister(cid(req), req.query as unknown as RegisterQuery)));

// ---- My letters ----

// GET /api/letters/mine
export const myLettersHandler = asyncHandler(async (req, res) => res.json(await myLetters(cid(req), currentUser(req))));
// GET /api/letters/mine/:id/pdf
export const myLetterPdfHandler = asyncHandler(async (req, res) => {
  const { pdf, fileName } = await myLetterPdf(cid(req), currentUser(req), num(req.params.id));
  sendPdf(res, pdf, fileName);
});

import { Router } from "express";
import multer from "multer";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { BadRequestError } from "../../utils/httpErrors.js";
import { DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "./employeeDocuments.service.js";
import {
  cancelExitHandler,
  createEmployeeHandler,
  deleteDocumentHandler,
  deleteEmployeeHandler,
  documentLinkHandler,
  exitHandler,
  getEmployeeHandler,
  listDocumentsHandler,
  listEmployeesHandler,
  rehireHandler,
  updateEmployeeHandler,
  uploadDocumentHandler,
} from "./employees.controller.js";
import { documentParams, documentSchema, employeeSchema, exitSchema } from "./employees.schema.js";
import { checkImportHandler, runImportHandler, templateHandler, templateQuery } from "./import/employeeImport.controller.js";

// Documents are held in memory only while they're sent on to ImageKit
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (DOCUMENT_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new BadRequestError("Upload a PDF or an image (JPEG, PNG, WebP)"));
  },
});

// Import files (CSV / Excel), read from memory
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/\.(csv|xlsx)$/i.test(file.originalname)) cb(null, true);
    else cb(new BadRequestError("Upload a .csv or .xlsx file"));
  },
});

const router = Router();

// Every route below runs: authenticate -> scopeToCompany -> permission -> validate -> controller
router.use(authenticate, scopeToCompany);

router.get("/", requirePermission("employees.view"), listEmployeesHandler);

// ---- Import from CSV / Excel (before /:id) ----
router.get("/import/template", requirePermission("employees.manage"), validate({ query: templateQuery }), templateHandler);
router.post("/import/check", requirePermission("employees.manage"), importUpload.single("file"), checkImportHandler);
router.post("/import", requirePermission("employees.manage"), importUpload.single("file"), runImportHandler);

router.post("/", requirePermission("employees.manage"), validate({ body: employeeSchema }), createEmployeeHandler);
router.put("/:id", requirePermission("employees.manage"), validate({ params: idParams, body: employeeSchema }), updateEmployeeHandler);
router.delete("/:id", requirePermission("employees.manage"), validate({ params: idParams }), deleteEmployeeHandler);
router.get("/:id", requirePermission("employees.view"), validate({ params: idParams }), getEmployeeHandler);

// ---- Leaving: notice, exit, cancel, rehire ----
router.post("/:id/exit", requirePermission("employees.manage"), validate({ params: idParams, body: exitSchema }), exitHandler);
router.post("/:id/cancel-exit", requirePermission("employees.manage"), validate({ params: idParams }), cancelExitHandler);
router.post("/:id/rehire", requirePermission("employees.manage"), validate({ params: idParams }), rehireHandler);

// ---- Documents (HR / Admin only — they hold ID proofs, contracts…) ----
router.get("/:id/documents", requirePermission("employees.manage"), validate({ params: idParams }), listDocumentsHandler);
router.post(
  "/:id/documents",
  requirePermission("employees.manage"),
  documentUpload.single("file"),
  validate({ params: idParams, body: documentSchema }),
  uploadDocumentHandler,
);
router.get("/:id/documents/:docId/link", requirePermission("employees.manage"), validate({ params: documentParams }), documentLinkHandler);
router.delete("/:id/documents/:docId", requirePermission("employees.manage"), validate({ params: documentParams }), deleteDocumentHandler);

export const employeeRoutes = router;

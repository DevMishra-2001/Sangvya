import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../middlewares/auth.middleware.js";
import { scopeToCompany } from "../../middlewares/tenant.middleware.js";
import { validate } from "../../middlewares/validate.js";
import { idParams } from "../../utils/zod.js";
import { fileUpload } from "../upload/upload.service.js";
import {
  createLetterHandler,
  createTemplateHandler,
  deleteLetterHandler,
  deleteTemplateHandler,
  employeeLettersHandler,
  letterFormHandler,
  letterheadImageHandler,
  letterPdfHandler,
  listTemplatesHandler,
  myLetterPdfHandler,
  myLettersHandler,
  previewLetterHandler,
  previewTemplateHandler,
  registerHandler,
  starterHandler,
  templateDetailHandler,
  updateLetterHandler,
  updateTemplateHandler,
  uploadFileHandler,
  variablesHandler,
} from "./letters.controller.js";
import { employeeParams, fileQuery, fillQuery, letterheadQuery, letterSchema, previewSchema, registerQuery, starterQuery, templateSchema } from "./letters.schema.js";

// HR letters: templates + letters for employees (letters.manage); an employee's own letters (letters.self)
const router = Router();
router.use(authenticate, scopeToCompany);

// My letters
const self = requirePermission("letters.self");
router.get("/mine", self, myLettersHandler);
router.get("/mine/:id/pdf", self, validate({ params: idParams }), myLetterPdfHandler);

const manage = requirePermission("letters.manage");
const letterParams = employeeParams.extend({ id: z.coerce.number().int().positive() });

// Templates
router.get("/variables", manage, variablesHandler);
router.get("/templates", manage, listTemplatesHandler);
router.get("/templates/letterhead", manage, validate({ query: letterheadQuery }), letterheadImageHandler);
router.get("/templates/starter", manage, validate({ query: starterQuery }), starterHandler);
router.post("/templates/preview", manage, validate({ body: previewSchema }), previewTemplateHandler);
router.get("/templates/:id", manage, validate({ params: idParams }), templateDetailHandler);
router.post("/templates", manage, validate({ body: templateSchema }), createTemplateHandler);
router.put("/templates/:id", manage, validate({ params: idParams, body: templateSchema }), updateTemplateHandler);
router.delete("/templates/:id", manage, validate({ params: idParams }), deleteTemplateHandler);
router.post("/files", manage, validate({ query: fileQuery }), fileUpload.single("file"), uploadFileHandler);

// Letters for an employee
router.get("/employees/:employeeId", manage, validate({ params: employeeParams }), employeeLettersHandler);
router.get("/employees/:employeeId/form", manage, validate({ params: employeeParams, query: fillQuery }), letterFormHandler);
router.post("/employees/:employeeId/preview", manage, validate({ params: employeeParams, body: letterSchema }), previewLetterHandler);
router.post("/employees/:employeeId", manage, validate({ params: employeeParams, body: letterSchema }), createLetterHandler);
router.put("/employees/:employeeId/:id", manage, validate({ params: letterParams, body: letterSchema }), updateLetterHandler);

// Register + one letter
router.get("/", manage, validate({ query: registerQuery }), registerHandler);
router.get("/:id/pdf", manage, validate({ params: idParams }), letterPdfHandler);
router.delete("/:id", manage, validate({ params: idParams }), deleteLetterHandler);

export const letterRoutes = router;

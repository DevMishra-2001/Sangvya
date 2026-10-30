import { z } from "zod";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { currentUser, tenant } from "../../../utils/requestContext.js";
import { checkImport, runImport } from "./employeeImport.service.js";
import { csvTemplate, xlsxTemplate } from "./importTemplate.js";

export const templateQuery = z.object({ format: z.enum(["xlsx", "csv"]).default("xlsx") });

// GET /api/employees/import/template?format=xlsx|csv
export const templateHandler = asyncHandler(async (req, res) => {
  const format = req.query.format === "csv" ? "csv" : "xlsx";
  const body = format === "csv" ? csvTemplate() : await xlsxTemplate(tenant(req).companyId);
  res.setHeader("Content-Type", format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="employee-import-template.${format}"`);
  res.setHeader("Content-Length", body.length);
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
});

// POST /api/employees/import/check (multipart: file) → row-by-row preview, nothing saved
export const checkImportHandler = asyncHandler(async (req, res) => {
  res.json(await checkImport(tenant(req).companyId, currentUser(req), req.file));
});

// POST /api/employees/import (multipart: file) → saves the rows without errors
export const runImportHandler = asyncHandler(async (req, res) => {
  res.json(await runImport(tenant(req).companyId, currentUser(req), req.file));
});

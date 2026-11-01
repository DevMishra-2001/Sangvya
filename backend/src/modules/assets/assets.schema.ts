import { z } from "zod";
import { ASSET_CATEGORIES, ASSET_CONDITIONS, ASSET_STATUSES } from "../../db/schemas/asset.schema.js";
import { pageQuery } from "../../utils/pagination.js";
import { optionalId, optionalIsoDate, optionalNumber, requiredText } from "../../utils/zod.js";

const blank = (v: unknown) => (v === undefined ? undefined : (typeof v === "string" ? v.trim() : v) || null);
const text = (max: number, label: string) => z.preprocess(blank, z.string().max(max, `${label} can be at most ${max} characters`).nullable().optional());
const isoDate = (label: string) => z.string({ required_error: `${label} is required` }).regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be a date`);

export const assetSchema = z.object({
  assetCode: text(30, "Asset code"), // empty = next free code (AST-0001…)
  name: requiredText("Asset name is required", 150),
  category: z.enum(ASSET_CATEGORIES, { errorMap: () => ({ message: "Pick a category" }) }),
  brand: text(80, "Brand"),
  model: text(80, "Model"),
  serialNumber: text(100, "Serial number"),
  purchaseDate: optionalIsoDate("Invalid purchase date"),
  purchaseCost: optionalNumber("Cost must be a positive number", { min: 0 }),
  warrantyUntil: optionalIsoDate("Invalid warranty date"),
  condition: z.enum(ASSET_CONDITIONS).default("good"),
  branchId: optionalId("Invalid branch"),
  notes: text(1000, "Notes"),
});
export type AssetInput = z.infer<typeof assetSchema>;

export const assignSchema = z.object({
  employeeId: z.coerce.number({ invalid_type_error: "Pick an employee" }).int().positive("Pick an employee"),
  assignedOn: isoDate("Assigned on"),
  expectedReturn: optionalIsoDate("Invalid return date"),
  notes: text(500, "Notes"),
});

// Give several items to one person in one go. Each row: a category, plus an optional serial / asset no.
export const assignManySchema = assignSchema.extend({
  items: z
    .array(
      z.object({
        assetId: optionalId("Invalid asset"),
        category: z.enum(ASSET_CATEGORIES, { errorMap: () => ({ message: "Pick a category" }) }),
        tag: text(100, "Serial / asset no."),
      }),
    )
    .min(1, "Add at least one item")
    .max(20, "Up to 20 items at a time"),
});

export const returnSchema = z.object({
  returnedOn: isoDate("Returned on"),
  condition: z.enum(ASSET_CONDITIONS, { errorMap: () => ({ message: "Pick the condition" }) }),
  // Where it goes after: back on the shelf, to repair, or written off
  status: z.enum(["available", "in_repair", "retired", "lost"]).default("available"),
  notes: text(500, "Notes"),
});

// Retire / lost / back from repair without an assignment
export const statusSchema = z.object({ status: z.enum(ASSET_STATUSES).refine((s) => s !== "assigned", "Assign it to someone instead"), notes: text(500, "Notes") });

export const listQuery = z.object({
  ...pageQuery,
  search: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(ASSET_STATUSES).optional().catch(undefined),
  category: z.enum(ASSET_CATEGORIES).optional().catch(undefined),
});

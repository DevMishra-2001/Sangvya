import { z } from "zod";
import { LETTERHEAD_MODES, LETTER_TYPES } from "../../db/schema.js";
import { VARIABLE_KEYS } from "./placeholders.js";

const text = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), z.string().max(max).nullable().optional());
const margin = z.coerce.number().int().min(20, "At least 20").max(320, "At most 320");

// The editor's document (TipTap JSON); kept under 200 KB
const body = z
  .object({ type: z.literal("doc"), content: z.array(z.record(z.unknown())).optional() })
  .passthrough()
  .refine((d) => JSON.stringify(d).length < 200_000, "The letter is too long");

const field = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,29}$/, "Field key: small letters, numbers or _ (e.g. probation_months)")
    .refine((k) => !VARIABLE_KEYS.has(k), "That key is already a built-in variable"),
  label: z.string().trim().min(1, "Name the field").max(60),
  type: z.enum(["text", "textarea", "date", "number"]),
  required: z.boolean(),
});

// POST / PUT /api/letters/templates
export const templateSchema = z
  .object({
    type: z.enum(LETTER_TYPES, { errorMap: () => ({ message: "Pick the letter type" }) }),
    name: z.string().trim().min(2, "Name the template").max(120),
    title: text(150),
    letterheadMode: z.enum(LETTERHEAD_MODES).default("company"),
    letterheadPath: text(500),
    letterheadName: text(255),
    pageNumbers: z.boolean().default(true),
    marginTop: margin,
    marginBottom: margin,
    marginLeft: margin,
    marginRight: margin,
    body,
    fields: z.array(field).max(15).default([]),
    signatoryName: text(120),
    signatoryTitle: text(120),
    signaturePath: text(500),
    numberPrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9/-]{1,20}$/, "Prefix: letters, numbers, / or - (e.g. HR/OFR)"),
    isActive: z.boolean().default(true),
  })
  .refine((t) => new Set(t.fields.map((f) => f.key)).size === t.fields.length, { path: ["fields"], message: "Two fields have the same key" })
  .refine((t) => t.letterheadMode !== "upload" || Boolean(t.letterheadPath), { path: ["letterheadPath"], message: "Upload your letterhead, or pick the company letterhead" });

// POST /api/letters/templates/preview — an unsaved template, filled for an employee (or with sample data)
export const previewSchema = z.object({ template: templateSchema, employeeId: z.coerce.number().int().positive().optional() });

export const starterQuery = z.object({ type: z.enum(LETTER_TYPES) });
export const fileQuery = z.object({ kind: z.enum(["letterhead", "signature"]) });
export const letterheadQuery = z.object({ path: z.string().trim().min(1).max(500) });
export const fillQuery = z.object({ templateId: z.coerce.number().int().positive() });

// POST /api/letters/employees/:employeeId and PUT /api/letters/:id — save a draft or issue it
export const letterSchema = z.object({
  templateId: z.coerce.number().int().positive(),
  values: z.record(z.string().max(60), z.string().max(4000)).default({}),
  issue: z.boolean().default(false),
});

export const registerQuery = z.object({
  type: z.enum(LETTER_TYPES).optional(),
  status: z.enum(["draft", "issued"]).optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const employeeParams = z.object({ employeeId: z.coerce.number().int().positive() });

export type TemplateInput = z.infer<typeof templateSchema>;
export type LetterInput = z.infer<typeof letterSchema>;
export type LetterheadQuery = z.infer<typeof letterheadQuery>;
export type RegisterQuery = z.infer<typeof registerQuery>;

import { z } from "zod";
import { SETTLEMENT_STATUSES } from "../../db/schemas/exit.schema.js";
import { pageQuery } from "../../utils/pagination.js";
import { optionalNumber } from "../../utils/zod.js";

const notes = z.preprocess((v) => (typeof v === "string" ? v.trim() : v) || null, z.string().max(2000, "Can be at most 2000 characters").nullable().optional());

export const listQuery = z.object({
  ...pageQuery,
  stage: z.enum(["open", "notice", "clearance", "settlement", "completed", "all"]).catch("open").default("open"),
  search: z.string().trim().max(100).optional().catch(undefined),
});

export const clearanceSchema = z.object({ done: z.boolean(), notes });

export const settlementSchema = z.object({
  lastSalary: optionalNumber("Amounts must be positive numbers", { min: 0 }),
  leaveEncashment: optionalNumber("Amounts must be positive numbers", { min: 0 }),
  bonus: optionalNumber("Amounts must be positive numbers", { min: 0 }),
  noticeRecovery: optionalNumber("Amounts must be positive numbers", { min: 0 }),
  otherDeductions: optionalNumber("Amounts must be positive numbers", { min: 0 }),
  notes,
  status: z.enum(SETTLEMENT_STATUSES),
  settledOn: z.preprocess((v) => v || null, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date").nullable().optional()),
});

export const interviewSchema = z.object({
  notes,
  rating: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(5).nullable().optional()),
  wouldRejoin: z.boolean().nullable().optional(),
});

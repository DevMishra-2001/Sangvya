import { z } from "zod";
import { ADVANCE_TYPES, TRAVEL_TYPES } from "../../db/schema.js";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const text = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), z.string().max(max).nullable().optional());
const amount = z.preprocess((v) => (v === "" || v == null ? 0 : v), z.coerce.number().min(0, "Amount can't be negative").max(10_000_000));

export const advanceSchema = z.object({
  advanceType: z.enum(ADVANCE_TYPES, { errorMap: () => ({ message: "Pick the advance type" }) }),
  amount: z.coerce.number().positive("Enter the amount").max(10_000_000),
  purpose: z.string().trim().min(3, "Say what it's for").max(1000),
  expectedDate: iso.nullable().optional(),
  ifsc: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() || null : v), z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC looks wrong (e.g. HDFC0001234)").nullable().optional()),
  accountNumber: z.preprocess((v) => (typeof v === "string" ? v.replace(/\s/g, "") || null : v), z.string().regex(/^\d{6,18}$/, "Account number is 6–18 digits").nullable().optional()),
  bankName: text(120),
});

const travelLine = z.object({
  travelType: z.enum(TRAVEL_TYPES),
  from: text(150),
  to: text(150),
  amount: z.coerce.number().min(0).max(10_000_000),
  description: text(500),
});

export const claimSchema = z.object({
  claimDate: iso,
  tripName: z.string().trim().min(2, "Name the trip / visit").max(150),
  country: text(80),
  state: text(80),
  city: text(80),
  locality: text(120),
  clientName: text(150),
  teammates: text(500),
  expenseType: z.enum(["domestic", "international"]).default("domestic"),
  hotelAmount: amount,
  hotelName: text(150),
  hotelDescription: text(1000),
  breakfast: amount,
  lunch: amount,
  dinner: amount,
  mealsDescription: text(1000),
  localTravel: z.array(travelLine).max(50).default([]),
  intercityTravel: z.array(travelLine).max(50).default([]),
  entertainmentAmount: amount,
  entertainmentDescription: text(1000),
  otherAmount: amount,
  otherDescription: text(1000),
  submit: z.boolean().default(false),
});

export const decisionSchema = z
  .object({
    action: z.enum(["approve", "reject", "hold"]),
    note: text(1000),
    approvedAmount: z.coerce.number().min(0).max(10_000_000).optional(), // claims: approve less than asked
  })
  .refine((v) => v.action === "approve" || v.note, { path: ["note"], message: "Add a note for the employee" });

export const paySchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000).optional(), // default = approved amount
  paidOn: iso,
  reference: text(80),
  // Salary advance: recovered in this many monthly EMIs from the next payroll
  emiMonths: z.coerce.number().int().min(1).max(36).default(1),
});

export const listQuery = z.object({
  kind: z.enum(["claims", "advances", "both"]).default("both"),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  status: z.string().max(20).optional(),
  scope: z.enum(["mine", "team", "all"]).default("mine"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const balanceQuery = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export type AdvanceInput = z.infer<typeof advanceSchema>;
export type ClaimInput = z.infer<typeof claimSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
export type PayInput = z.infer<typeof paySchema>;
export type ListQuery = z.infer<typeof listQuery>;

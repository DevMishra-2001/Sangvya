import { z } from "zod";
import { TICKET_STATUS_KINDS } from "../../db/schema.js";

const blank = (v: unknown) => (v === "" || v === undefined ? null : v);
const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const text = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), z.string().max(max).nullable().optional());
const ref = z.preprocess(blank, z.coerce.number().int().positive().nullable().optional());
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour");
const files = z.array(z.object({ path: z.string().max(500), name: z.string().max(255) })).max(10).optional();

// ---- Tickets ----

export const ticketSchema = z.object({
  title: z.string().trim().min(3, "Give the ticket a title").max(200),
  description: text(10000),
  projectId: ref,
  moduleId: ref,
  categoryId: ref,
  priorityId: ref,
  statusId: ref,
  assignedTo: ref,
  secondaryAssignee: ref,
  reportedByName: text(120),
  reportedByMobile: z.preprocess((v) => (typeof v === "string" ? v.trim() || null : v), z.string().regex(/^[+\d][\d\s()-]{5,19}$/, "Enter a valid mobile number").nullable().optional()),
  pageUrl: text(500),
  dueDate: z.preprocess(blank, iso.nullable().optional()),
  estimateMinutes: z.preprocess(blank, z.coerce.number().int().min(0).max(100_000).nullable().optional()),
  attachments: files,
});

export const statusChangeSchema = z.object({ statusId: z.coerce.number().int().positive(), note: text(1000) });
export const assignSchema = z.object({ assignedTo: ref, secondaryAssignee: ref, note: text(1000) });
export const commentSchema = z.object({ body: z.string().trim().min(1, "Write something").max(5000) });
export const timeLogSchema = z.object({
  workDate: iso,
  minutes: z.coerce.number().int().min(1, "At least 1 minute").max(1440, "At most 24 hours a day"),
  note: text(500),
});

const idList = z.preprocess((v) => (typeof v === "string" && v ? v.split(",").map(Number) : undefined), z.array(z.number().int().positive()).max(50).optional());

export const listQuery = z.object({
  scope: z.enum(["mine", "created", "team", "all"]).default("mine"),
  q: z.string().trim().max(100).optional(),
  projectId: idList,
  categoryId: idList,
  statusId: idList,
  priorityId: idList,
  assignedTo: idList,
  departmentId: z.coerce.number().int().positive().optional(),
  view: z.enum(["open", "finished", "delayed", "all"]).default("all"),
  createdFrom: iso.optional(),
  createdTo: iso.optional(),
  dueFrom: iso.optional(),
  dueTo: iso.optional(),
  sort: z.enum(["created", "due", "updated", "code"]).default("created"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const boardQuery = z.object({ employeeId: z.coerce.number().int().positive().optional() });
export const calendarQuery = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Pick a month"),
  employeeId: z.coerce.number().int().positive().optional(),
});

// ---- Settings ----

const active = z.boolean().default(true);
const sort = z.coerce.number().int().min(0).max(999).default(0);

export const projectSchema = z.object({
  name: z.string().trim().min(2, "Name the project").max(150),
  code: text(20),
  clientName: text(150),
  version: text(50),
  description: text(1000),
  defaultAssigneeId: ref,
  isActive: active,
  sortOrder: sort,
});
export const moduleSchema = z.object({ projectId: z.coerce.number().int().positive("Pick the project"), name: z.string().trim().min(1, "Name the module").max(120), isActive: active });
export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name the category").max(80),
  color,
  defaultDays: z.preprocess(blank, z.coerce.number().int().min(0).max(365).nullable().optional()),
  isActive: active,
  sortOrder: sort,
});
export const statusSchema = z.object({
  name: z.string().trim().min(2, "Name the status").max(50),
  color,
  kind: z.enum(TICKET_STATUS_KINDS, { errorMap: () => ({ message: "Pick what this status means" }) }),
  isDefault: z.boolean().default(false),
  isActive: active,
  sortOrder: sort,
});
export const prioritySchema = z.object({
  name: z.string().trim().min(2, "Name the priority").max(50),
  color,
  slaHours: z.preprocess(blank, z.coerce.number().int().min(1).max(8760).nullable().optional()),
  isDefault: z.boolean().default(false),
  isActive: active,
  sortOrder: sort,
});
export const generalSchema = z.object({
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,10}$/, "Up to 10 letters, numbers or dashes, e.g. TKT-"),
  numberDigits: z.coerce.number().int().min(2).max(8),
  whoCanCreate: z.enum(["everyone", "managers"]),
  assignAnyone: z.boolean(),
  allowSelfAssign: z.boolean(),
  requireProject: z.boolean(),
  requireTimeOnDone: z.boolean(),
  autoCloseDays: z.preprocess(blank, z.coerce.number().int().min(1).max(365).nullable().optional()),
  notifyOnAssign: z.boolean(),
});

export const SETTING_LISTS = ["projects", "modules", "categories", "statuses", "priorities"] as const;
export type SettingList = (typeof SETTING_LISTS)[number];
export const settingParams = z.object({ list: z.enum(SETTING_LISTS), id: z.coerce.number().int().positive().optional() });

export type TicketInput = z.infer<typeof ticketSchema>;
export type ListQuery = z.infer<typeof listQuery>;
export type GeneralInput = z.infer<typeof generalSchema>;

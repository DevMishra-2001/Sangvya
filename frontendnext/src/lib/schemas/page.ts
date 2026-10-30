import { z } from "zod";
import { requiredText } from "./common";

// Page Master form → API payload
export const pageSchema = z.object({
  name: requiredText("Page name is required", 100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug is required")
    .max(60, "At most 60 characters")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes"),
  url: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\/[a-z0-9\-/]*$/.test(v), "Starts with /, e.g. /leave-policy")
    .transform((v) => v || null),
  icon: z.string().transform((v) => v || null),
  parentId: z.string().transform((v) => (v ? Number(v) : null)),
  sortOrder: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+$/.test(v), "A whole number")
    .transform((v) => (v ? Number(v) : 0)),
  showInMenu: z.enum(["yes", "no"]).transform((v) => v === "yes"),
  isActive: z.enum(["active", "inactive"]).transform((v) => v === "active"),
  roleIds: z.array(z.string()).transform((ids) => ids.map(Number)),
});

export type PageForm = z.input<typeof pageSchema>;
export type PagePayload = z.output<typeof pageSchema>;

// "Leave Policy" → "leave-policy"
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

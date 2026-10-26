import { z } from "zod";
import { requiredText } from "../../utils/zod.js";

// Page Master form. url empty = a menu group that holds other pages.
export const pageSchema = z.object({
  name: requiredText("Page name is required", 100),
  slug: z
    .string({ required_error: "Slug is required" })
    .trim()
    .toLowerCase()
    .min(1, "Slug is required")
    .max(60, "Slug can be at most 60 characters")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug: lowercase letters, numbers and dashes, e.g. leave-policy"),
  url: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v) || null,
    z
      .string()
      .max(200, "URL can be at most 200 characters")
      .regex(/^\/[a-z0-9\-/]*$/, "URL must start with / and use lowercase letters, numbers, - and /, e.g. /leave-policy")
      .nullable(),
  ),
  icon: z.preprocess((v) => v || null, z.string().max(40).nullable()),
  parentId: z.preprocess((v) => (v === "" || v === 0 ? null : v), z.coerce.number().int().positive().nullable().default(null)),
  sortOrder: z.coerce.number({ invalid_type_error: "Order must be a number" }).int().min(0).max(32000).default(0),
  showInMenu: z.boolean().default(true),
  isActive: z.boolean().default(true),
  designationIds: z.array(z.coerce.number().int().positive()).default([]),
});

export type PageInput = z.infer<typeof pageSchema>;

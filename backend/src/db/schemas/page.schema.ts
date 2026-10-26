import { boolean, integer, pgTable, primaryKey, smallint, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id } from "../columns.js";
import { designations } from "./designation.schema.js";

// Page Master: every page of the app, managed by the Super Admin. The sidebar,
// the page guard and the API permissions all come from these rows.
//   url NULL  = a menu group (e.g. "My Attendance") holding child pages
//   slug      = stable key the backend maps to API permissions (access.service.ts)
export const appPages = pgTable(
  "app_pages",
  {
    id: id(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 60 }).notNull().unique("app_pages_slug_key"),
    url: varchar("url", { length: 200 }),
    icon: varchar("icon", { length: 40 }),
    parent_id: integer("parent_id"),
    sort_order: smallint("sort_order").notNull().default(0),
    // false = a real page that isn't listed in the sidebar (e.g. New company)
    show_in_menu: boolean("show_in_menu").notNull().default(true),
    is_active: boolean("is_active").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [fk("app_pages", t.parent_id, t.id, "set null")],
);

// Which designations can open which page
export const appPageAccess = pgTable(
  "app_page_access",
  {
    page_id: integer("page_id").notNull(),
    designation_id: integer("designation_id").notNull(),
  },
  (t) => [
    primaryKey({ name: "app_page_access_pkey", columns: [t.page_id, t.designation_id] }),
    fk("app_page_access", t.page_id, appPages.id, "cascade"),
    fk("app_page_access", t.designation_id, designations.id, "cascade"),
  ],
);

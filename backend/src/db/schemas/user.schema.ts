import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, smallint, text, unique, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { createdAt, fk, id, timestamptz } from "../columns.js";
import { companies } from "./company.schema.js";
import { employees } from "./employee.schema.js";

// A login (one per email, across all companies).
// company_id / employee_id are the user's *current* company and their employee
// record in it — what every request works with. A superadmin can own several
// companies (see company_members) and switch between them; everyone else
// belongs to exactly one. A new superadmin has no company until they create one.
export const users = pgTable(
  "users",
  {
    id: id(),
    company_id: integer("company_id"),
    name: varchar("name", { length: 150 }).notNull(),
    email: varchar("email", { length: 150 }).notNull().unique("users_email_key"),
    password_hash: text("password_hash").notNull(),
    // "superadmin" = platform developer (npm run make-superadmin); everyone else is
    // "member" and gets access from their role in the current company
    role: varchar("role", { length: 30 }).notNull().default("member"),
    created_at: createdAt(),
    employee_id: integer("employee_id"),
    // Set when they first set their password (activation link). NULL = invited, not activated yet
    activated_at: timestamptz("activated_at"),
    // Blocked logins can't log in; their open sessions are ended when blocked
    is_blocked: boolean("is_blocked").notNull().default(false),
    // Set when someone else sets their password (e.g. the admin creating an
    // employee's login): they must choose their own on next login
    must_change_password: boolean("must_change_password").notNull().default(false),
    // The user's own UI font size (10–17px, 13 = normal)
    font_size: smallint("font_size").notNull().default(13),
    // Appearance, saved per login so it follows them to any device
    theme: varchar("theme", { length: 10 }).notNull().default("system").$type<"light" | "dark" | "system">(),
    accent: varchar("accent", { length: 12 }).notNull().default("blue"),
    menu_layout: varchar("menu_layout", { length: 12 }).notNull().default("vertical").$type<"vertical" | "horizontal">(),
  },
  (t) => [
    fk("users", t.company_id, companies.id, "set null"),
    fk("users", t.employee_id, employees.id, "set null"),
    uniqueIndex("idx_users_employee").on(t.employee_id).where(sql`${t.employee_id} IS NOT NULL`),
    check("users_font_size_check", sql`${t.font_size} >= 10 AND ${t.font_size} <= 17`),
  ],
);

// One row per login. The short-lived access JWT carries the session id; the
// refresh token (only its hash is stored) is rotated on every refresh.
// last_activity_at moves only when the user is actually active, so an idle
// session can't be refreshed after SESSION_IDLE_MIN.
export const userSessions = pgTable(
  "user_sessions",
  {
    id: id(),
    user_id: integer("user_id").notNull(),
    refresh_token_hash: text("refresh_token_hash").notNull(),
    previous_token_hash: text("previous_token_hash"), // the token just replaced (grace window for parallel tabs)
    rotated_at: timestamptz("rotated_at"),
    last_activity_at: timestamptz("last_activity_at").notNull().defaultNow(),
    expires_at: timestamptz("expires_at").notNull(), // absolute limit, however active the user is
    revoked_at: timestamptz("revoked_at"),
    user_agent: text("user_agent"),
    ip: text("ip"),
    created_at: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    fk("user_sessions", t.user_id, users.id, "cascade"),
    index("idx_user_sessions_user").on(t.user_id),
    index("idx_user_sessions_token").on(t.refresh_token_hash),
    index("idx_user_sessions_prev").on(t.previous_token_hash),
  ],
);

// Forgot password (OTP). One active request per user; only hashes are stored.
// Flow: OTP emailed → verified (attempts capped) → short-lived reset token → new password.
export const passwordResets = pgTable(
  "password_resets",
  {
    id: id(),
    user_id: integer("user_id").notNull(),
    otp_hash: text("otp_hash").notNull(),
    otp_expires_at: timestamptz("otp_expires_at").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    verified_at: timestamptz("verified_at"),
    reset_token_hash: text("reset_token_hash"),
    reset_expires_at: timestamptz("reset_expires_at"),
    used_at: timestamptz("used_at"),
    created_at: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    fk("password_resets", t.user_id, users.id, "cascade"),
    index("idx_password_resets_user").on(t.user_id),
    index("idx_password_resets_token").on(t.reset_token_hash),
  ],
);

// Which companies a login can open, and its employee record in each.
// Kept in step with users.company_id / users.employee_id for the current one.
export const companyMembers = pgTable(
  "company_members",
  {
    id: id(),
    user_id: integer("user_id").notNull(),
    company_id: integer("company_id").notNull(),
    employee_id: integer("employee_id"),
    created_at: createdAt(),
  },
  (t) => [
    fk("company_members", t.user_id, users.id, "cascade"),
    fk("company_members", t.company_id, companies.id, "cascade"),
    fk("company_members", t.employee_id, employees.id, "set null"),
    unique("company_members_user_id_company_id_key").on(t.user_id, t.company_id),
    index("idx_company_members_company").on(t.company_id),
  ],
);

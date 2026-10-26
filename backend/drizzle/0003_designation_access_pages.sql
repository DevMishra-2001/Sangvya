-- Designations become one fixed, shared list that controls access, and the
-- Page Master tables are added. Existing people keep working:
--   company owners (old role superadmin) -> Admin, old role hr -> HR, everyone else -> Developer.
-- The platform Super Admin is set afterwards with: npm run make-superadmin -- <email>

CREATE TABLE "app_page_access" (
	"page_id" integer NOT NULL,
	"designation_id" integer NOT NULL,
	CONSTRAINT "app_page_access_pkey" PRIMARY KEY("page_id","designation_id")
);
--> statement-breakpoint
CREATE TABLE "app_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(60) NOT NULL,
	"url" varchar(200),
	"icon" varchar(40),
	"parent_id" integer,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"show_in_menu" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "app_pages_slug_key" UNIQUE("slug")
);
--> statement-breakpoint

-- 1. Work out each employee's new designation before the old ones go
ALTER TABLE "employees" ADD COLUMN "_access" varchar(20) DEFAULT 'developer' NOT NULL;--> statement-breakpoint
UPDATE "employees" e SET "_access" = CASE u."role" WHEN 'superadmin' THEN 'admin' WHEN 'hr' THEN 'hr' ELSE 'developer' END
  FROM "company_members" m JOIN "users" u ON u."id" = m."user_id"
  WHERE m."employee_id" = e."id";--> statement-breakpoint

-- 2. Replace the per-company designations with the shared five
UPDATE "employees" SET "designation_id" = NULL;--> statement-breakpoint
DELETE FROM "designations";--> statement-breakpoint
DROP INDEX "idx_designations_company";--> statement-breakpoint
DROP INDEX "idx_designations_name";--> statement-breakpoint
ALTER TABLE "designations" ALTER COLUMN "company_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "designations" ADD COLUMN "key" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "designations" ADD COLUMN "level" smallint NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_designations_key" ON "designations" USING btree ("key");--> statement-breakpoint
INSERT INTO "designations" ("key", "name", "level") VALUES
  ('superadmin', 'Super Admin', 5),
  ('admin', 'Admin', 4),
  ('hr', 'HR', 3),
  ('accountant', 'Accountant', 2),
  ('developer', 'Developer', 1);--> statement-breakpoint
UPDATE "employees" e SET "designation_id" = d."id" FROM "designations" d WHERE d."key" = e."_access";--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN "_access";--> statement-breakpoint

-- 3. Login roles: only the platform Super Admin keeps a special role
UPDATE "users" SET "role" = 'member';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'member';--> statement-breakpoint

-- 4. Page Master
ALTER TABLE "app_page_access" ADD CONSTRAINT "app_page_access_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."app_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_page_access" ADD CONSTRAINT "app_page_access_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_pages" ADD CONSTRAINT "app_pages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."app_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu") VALUES
  ('dashboard', 'Dashboard', '/', 'LayoutGrid', 10, true),
  ('employees', 'Employees', '/employees', 'Users', 20, true),
  ('designations', 'Designations', '/designations', 'BadgeCheck', 30, true),
  ('my-attendance', 'My Attendance', NULL, 'CalendarDays', 40, true),
  ('attendance', 'Team Attendance', '/attendance', 'CalendarCheck', 50, true),
  ('leave', 'Leave', '/leave', 'CalendarClock', 60, true),
  ('tickets', 'Tickets', '/tickets', 'Ticket', 70, true),
  ('change-password', 'Change Password', '/change-password', 'KeyRound', 80, true),
  ('payroll', 'Payroll', '/payroll', 'Wallet', 90, true),
  ('recruitment', 'Recruitment', '/recruitment', 'Briefcase', 100, true),
  ('performance', 'Performance', '/performance', 'Star', 110, true),
  ('holidays', 'Holidays', '/holidays', 'PartyPopper', 120, true),
  ('leave-policy', 'Leave Policy', '/leave-policy', 'Scale', 130, true),
  ('billing', 'Billing', '/billing', 'CreditCard', 140, true),
  ('users', 'Users & Roles', '/users', 'ShieldCheck', 150, true),
  ('page-master', 'Page Master', '/page-master', 'LayoutList', 160, true),
  ('new-company', 'New company', '/companies/new', 'Building2', 170, false);--> statement-breakpoint
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "parent_id")
  SELECT v.slug, v.name, v.url, v.icon, v.sort_order, p."id"
  FROM (VALUES
    ('my-attendance-today', 'Attendance', '/my-attendance', 'Fingerprint', 1),
    ('my-attendance-calendar', 'Attendance Calendar', '/my-attendance/calendar', 'CalendarRange', 2),
    ('my-attendance-report', 'Attendance Report', '/my-attendance/report', 'FileBarChart', 3),
    ('my-attendance-leaves', 'Leave View Approval', '/my-attendance/leaves', 'ClipboardList', 4)
  ) AS v(slug, name, url, icon, sort_order)
  CROSS JOIN "app_pages" p WHERE p."slug" = 'my-attendance';--> statement-breakpoint

-- Who sees what by default (the Super Admin always sees every page)
INSERT INTO "app_page_access" ("page_id", "designation_id")
  SELECT p."id", d."id"
  FROM (VALUES
    ('dashboard', 'admin'), ('dashboard', 'hr'), ('dashboard', 'accountant'), ('dashboard', 'developer'),
    ('employees', 'admin'), ('employees', 'hr'),
    ('my-attendance', 'admin'), ('my-attendance', 'hr'), ('my-attendance', 'accountant'), ('my-attendance', 'developer'),
    ('my-attendance-today', 'admin'), ('my-attendance-today', 'hr'), ('my-attendance-today', 'accountant'), ('my-attendance-today', 'developer'),
    ('my-attendance-calendar', 'admin'), ('my-attendance-calendar', 'hr'), ('my-attendance-calendar', 'accountant'), ('my-attendance-calendar', 'developer'),
    ('my-attendance-report', 'admin'), ('my-attendance-report', 'hr'), ('my-attendance-report', 'accountant'), ('my-attendance-report', 'developer'),
    ('my-attendance-leaves', 'admin'), ('my-attendance-leaves', 'hr'), ('my-attendance-leaves', 'accountant'), ('my-attendance-leaves', 'developer'),
    ('attendance', 'admin'), ('attendance', 'hr'),
    ('leave', 'admin'), ('leave', 'hr'), ('leave', 'accountant'), ('leave', 'developer'),
    ('tickets', 'admin'), ('tickets', 'hr'), ('tickets', 'accountant'), ('tickets', 'developer'),
    ('change-password', 'admin'), ('change-password', 'hr'), ('change-password', 'accountant'), ('change-password', 'developer'),
    ('payroll', 'admin'), ('payroll', 'hr'), ('payroll', 'accountant'),
    ('recruitment', 'admin'), ('recruitment', 'hr'),
    ('performance', 'admin'), ('performance', 'hr'),
    ('holidays', 'admin'), ('holidays', 'hr'),
    ('leave-policy', 'admin'), ('leave-policy', 'hr'),
    ('billing', 'admin'), ('billing', 'accountant'),
    ('users', 'admin'), ('users', 'hr'),
    ('new-company', 'admin')
  ) AS g(slug, dkey)
  JOIN "app_pages" p ON p."slug" = g.slug
  JOIN "designations" d ON d."key" = g.dkey;

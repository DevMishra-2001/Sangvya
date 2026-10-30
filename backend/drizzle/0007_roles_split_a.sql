CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"level" smallint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_page_roles" (
	"page_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "app_page_roles_pkey" PRIMARY KEY("page_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "role_id" integer;--> statement-breakpoint
ALTER TABLE "app_page_roles" ADD CONSTRAINT "app_page_roles_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."app_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_page_roles" ADD CONSTRAINT "app_page_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roles_key" ON "roles" USING btree ("key");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Data: the fixed five move from designations to roles (Developer becomes Employee)
INSERT INTO "roles" ("key", "name", "level", "is_active", "created_at")
  SELECT CASE d."key" WHEN 'developer' THEN 'employee' ELSE d."key" END,
         CASE d."key" WHEN 'developer' THEN 'Employee' ELSE d."name" END,
         d."level", d."is_active", d."created_at"
  FROM "designations" d
  WHERE d."key" IS NOT NULL;--> statement-breakpoint
-- Fresh databases (no old rows) still get the five
INSERT INTO "roles" ("key", "name", "level") VALUES
  ('superadmin', 'Super Admin', 5), ('admin', 'Admin', 4), ('hr', 'HR', 3), ('accountant', 'Accountant', 2), ('employee', 'Employee', 1)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT a."page_id", r."id"
  FROM "app_page_access" a
  JOIN "designations" d ON d."id" = a."designation_id"
  JOIN "roles" r ON r."key" = CASE d."key" WHEN 'developer' THEN 'employee' ELSE d."key" END
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "employees" e SET "role_id" = r."id"
  FROM "designations" d
  JOIN "roles" r ON r."key" = CASE d."key" WHEN 'developer' THEN 'employee' ELSE d."key" END
  WHERE d."id" = e."designation_id";--> statement-breakpoint

-- Pages: Roles (Super Admin only) replaces the old Designations master; the
-- Designations page is now each company's own job titles (Admin + HR)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('roles', 'Roles', '/roles', 'ShieldCheck', 158, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
UPDATE "app_pages" SET "name" = 'Users', "icon" = 'UserPlus' WHERE "slug" = 'users';--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr')
  WHERE p."slug" = 'designations'
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Designations start empty: each company adds its own job titles
UPDATE "employees" SET "designation_id" = NULL;--> statement-breakpoint
DELETE FROM "designations";

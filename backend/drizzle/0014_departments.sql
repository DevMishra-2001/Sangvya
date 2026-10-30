CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20),
	"head_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "department_id" integer;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_departments_company" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_departments_name" ON "departments" USING btree ("company_id",lower("name"));--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Each company's existing free-text departments become its department list
-- (one per distinct name, case-insensitive), and employees point at them.
-- The text column is dropped in the next migration.
INSERT INTO "departments" ("company_id", "name")
  SELECT DISTINCT ON (e."company_id", lower(trim(e."department"))) e."company_id", trim(e."department")
  FROM "employees" e
  WHERE e."department" IS NOT NULL AND trim(e."department") <> ''
  ORDER BY e."company_id", lower(trim(e."department")), e."id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "employees" e SET "department_id" = d."id"
  FROM "departments" d
  WHERE d."company_id" = e."company_id" AND lower(d."name") = lower(trim(e."department"));--> statement-breakpoint
-- Departments page (Admin + HR), next to Designations
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('departments', 'Departments', '/departments', 'Network', 25, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr')
  WHERE p."slug" = 'departments'
ON CONFLICT DO NOTHING;

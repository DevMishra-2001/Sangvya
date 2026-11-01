CREATE TABLE "asset_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"asset_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"assigned_on" date NOT NULL,
	"expected_return" date,
	"assigned_by" integer,
	"assign_notes" text,
	"returned_on" date,
	"return_condition" varchar(10),
	"returned_to" integer,
	"return_notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"asset_code" varchar(30) NOT NULL,
	"name" varchar(150) NOT NULL,
	"category" varchar(20) NOT NULL,
	"brand" varchar(80),
	"model" varchar(80),
	"serial_number" varchar(100),
	"purchase_date" date,
	"purchase_cost" numeric(12, 2),
	"warranty_until" date,
	"condition" varchar(10) DEFAULT 'good' NOT NULL,
	"status" varchar(12) DEFAULT 'available' NOT NULL,
	"branch_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "probation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"action" varchar(15) NOT NULL,
	"old_end" date,
	"new_end" date,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_exits" (
	"employee_id" integer PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"started_on" date,
	"interview_notes" text,
	"interview_rating" smallint,
	"would_rejoin" boolean,
	"last_salary" numeric(12, 2),
	"leave_encashment" numeric(12, 2),
	"bonus" numeric(12, 2),
	"notice_recovery" numeric(12, 2),
	"other_deductions" numeric(12, 2),
	"settlement_notes" text,
	"settlement_status" varchar(10) DEFAULT 'pending' NOT NULL,
	"settled_on" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exit_clearances" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"item_key" varchar(30) NOT NULL,
	"label" varchar(100) NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_by" integer,
	"done_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "probation_status" varchar(15);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "confirmed_on" date;--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignments" ADD CONSTRAINT "asset_assignments_returned_to_fkey" FOREIGN KEY ("returned_to") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probation_events" ADD CONSTRAINT "probation_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probation_events" ADD CONSTRAINT "probation_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "probation_events" ADD CONSTRAINT "probation_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_exits" ADD CONSTRAINT "employee_exits_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_exits" ADD CONSTRAINT "employee_exits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_clearances" ADD CONSTRAINT "exit_clearances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_clearances" ADD CONSTRAINT "exit_clearances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_clearances" ADD CONSTRAINT "exit_clearances_done_by_fkey" FOREIGN KEY ("done_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_asset_assignments_asset" ON "asset_assignments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_asset_assignments_employee" ON "asset_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_asset_assignments_open" ON "asset_assignments" USING btree ("asset_id") WHERE "asset_assignments"."returned_on" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_assets_code" ON "assets" USING btree ("company_id",lower("asset_code"));--> statement-breakpoint
CREATE INDEX "idx_assets_company_status" ON "assets" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_probation_events_employee" ON "probation_events" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_exit_clearances_item" ON "exit_clearances" USING btree ("employee_id","item_key");--> statement-breakpoint
-- Anyone with a probation end date is on probation
UPDATE "employees" SET "probation_status" = 'on_probation' WHERE "probation_end_date" IS NOT NULL AND "probation_status" IS NULL AND "status" <> 'exited';--> statement-breakpoint
-- Pages under People: Probation, Exits, Assets (Admin + HR)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT v.slug, v.name, v.url, v.icon, v.sort, true, g."id"
  FROM (VALUES ('probation', 'Probation', '/probation', 'CalendarClock', 4), ('exits', 'Exits', '/exits', 'UserMinus', 5), ('assets', 'Assets', '/assets', 'Laptop', 6)) AS v(slug, name, url, icon, sort)
  JOIN "app_pages" g ON g."slug" = 'grp-people'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr') AND r."company_id" IS NULL
  WHERE p."slug" IN ('probation', 'exits', 'assets')
ON CONFLICT DO NOTHING;

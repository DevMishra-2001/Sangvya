CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(60) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"grace_minutes" smallint DEFAULT 10 NOT NULL,
	"break_minutes" smallint DEFAULT 60 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "attendance_corrections" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"date" date NOT NULL,
	"punch_in" timestamp with time zone NOT NULL,
	"punch_out" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "shift_id" integer;--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "late_minutes" integer;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_shifts_company" ON "shifts" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_shifts_name" ON "shifts" USING btree ("company_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "idx_shifts_default" ON "shifts" USING btree ("company_id") WHERE "shifts"."is_default";--> statement-breakpoint
CREATE INDEX "idx_attendance_corrections_company" ON "attendance_corrections" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_attendance_corrections_employee" ON "attendance_corrections" USING btree ("employee_id","date");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Every company starts with a default "General shift" from its office hours
-- (09:00–18:00 when they aren't set), 10 minutes' grace and a 60-minute break.
INSERT INTO "shifts" ("company_id", "name", "start_time", "end_time", "grace_minutes", "break_minutes", "is_default")
  SELECT c."id", 'General shift', coalesce(c."office_start", '09:00'),
         CASE WHEN coalesce(c."office_end", '18:00') = coalesce(c."office_start", '09:00') THEN '18:00' ELSE coalesce(c."office_end", '18:00') END,
         10, 60, true
  FROM "companies" c
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Late marks for past check-ins, by that shift (times in Asia/Kolkata, the app's timezone)
UPDATE "attendance" a SET "late_minutes" = CASE
    WHEN diff > s."grace_minutes" THEN diff ELSE 0 END
  FROM (
    SELECT a2."id",
           (extract(epoch FROM ((a2."punch_in" AT TIME ZONE 'Asia/Kolkata')::time - s2."start_time"::time)) / 60)::int AS diff,
           s2."id" AS shift_id
    FROM "attendance" a2
    JOIN "shifts" s2 ON s2."company_id" = a2."company_id" AND s2."is_default"
    WHERE a2."punch_in" IS NOT NULL
  ) d
  JOIN "shifts" s ON s."id" = d.shift_id
  WHERE a."id" = d."id";--> statement-breakpoint
-- Pages: Shifts (Admin + HR) and Corrections under My Attendance (everyone)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('shifts', 'Shifts', '/shifts', 'Timer', 55, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr')
  WHERE p."slug" = 'shifts'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT 'my-attendance-corrections', 'Corrections', '/my-attendance/corrections', 'ClipboardList', 5, true, g."id"
  FROM "app_pages" g WHERE g."slug" = 'my-attendance'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr', 'accountant', 'employee')
  WHERE p."slug" = 'my-attendance-corrections'
ON CONFLICT DO NOTHING;

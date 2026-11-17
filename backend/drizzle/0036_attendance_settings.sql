CREATE TABLE "attendance_settings" (
	"company_id" integer PRIMARY KEY NOT NULL,
	"default_required_minutes" smallint DEFAULT 540 NOT NULL,
	"default_break_minutes" smallint DEFAULT 60 NOT NULL,
	"status_by_hours" boolean DEFAULT false NOT NULL,
	"half_day_below_minutes" smallint DEFAULT 270 NOT NULL,
	"absent_below_minutes" smallint DEFAULT 120 NOT NULL,
	"late_penalty_enabled" boolean DEFAULT false NOT NULL,
	"late_marks_per_penalty" smallint DEFAULT 3 NOT NULL,
	"late_penalty" varchar(4) DEFAULT 'half' NOT NULL,
	"count_early_leaving" boolean DEFAULT false NOT NULL,
	"early_leaving_grace_minutes" smallint DEFAULT 0 NOT NULL,
	"off_saturdays" varchar(12),
	"photo_rule" varchar(10) DEFAULT 'optional' NOT NULL,
	"location_rule" varchar(10) DEFAULT 'optional' NOT NULL,
	"geofence_enabled" boolean DEFAULT true NOT NULL,
	"early_check_in_minutes" smallint,
	"missing_checkout" varchar(10) DEFAULT 'flag' NOT NULL,
	"corrections_enabled" boolean DEFAULT true NOT NULL,
	"correction_days_back" smallint DEFAULT 30 NOT NULL,
	"corrections_per_month" smallint,
	"overtime_enabled" boolean DEFAULT false NOT NULL,
	"overtime_after_minutes" smallint DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_settings" ADD CONSTRAINT "attendance_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Attendance Settings page (Admin, HR) in the Attendance menu, after Shifts
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT 'attendance-settings', 'Attendance Settings', '/attendance/settings', 'Settings', 7, true, g."id"
  FROM "app_pages" g WHERE g."slug" = 'my-attendance'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr') AND r."company_id" IS NULL
  WHERE p."slug" = 'attendance-settings'
ON CONFLICT DO NOTHING;

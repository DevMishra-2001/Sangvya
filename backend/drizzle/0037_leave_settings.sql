CREATE TABLE "leave_settings" (
	"company_id" integer PRIMARY KEY NOT NULL,
	"sandwich_rule" boolean DEFAULT false NOT NULL,
	"backdated_days" smallint,
	"when_short" varchar(6) DEFAULT 'block' NOT NULL,
	"comp_off_valid_days" smallint DEFAULT 90 NOT NULL,
	"comp_off_full_minutes" smallint DEFAULT 0 NOT NULL,
	"comp_off_half_minutes" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(60) NOT NULL,
	"short_name" varchar(12) NOT NULL,
	"color" varchar(9) DEFAULT '#2563eb' NOT NULL,
	"kind" varchar(10) DEFAULT 'quota' NOT NULL,
	"is_paid" boolean DEFAULT true NOT NULL,
	"quota" numeric(5, 1) DEFAULT '0' NOT NULL,
	"quota_period" varchar(6) DEFAULT 'year' NOT NULL,
	"carry_forward" varchar(4) DEFAULT 'none' NOT NULL,
	"carry_max" numeric(5, 1),
	"allow_half_day" boolean DEFAULT true NOT NULL,
	"gender" varchar(6) DEFAULT 'all' NOT NULL,
	"after_probation" boolean DEFAULT false NOT NULL,
	"min_notice_days" smallint,
	"max_days_per_request" numeric(5, 1),
	"document_after_days" numeric(5, 1),
	"optional_holidays_only" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "leave_types_company_code_key" UNIQUE("company_id","code")
);
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leave_settings" ADD CONSTRAINT "leave_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_settings" ADD CONSTRAINT "leave_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_settings" ADD CONSTRAINT "leave_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Every company's leave types, from its current leave policy (or the defaults)
INSERT INTO "leave_types" ("company_id", "code", "name", "short_name", "color", "kind", "is_paid", "quota", "quota_period", "carry_forward", "optional_holidays_only", "is_system", "is_active", "sort_order")
  SELECT c."id", v.code, v.name, v.short, v.color, v.kind, v.paid,
    CASE v.code WHEN 'cl' THEN coalesce(p."cl_per_year", 6) WHEN 'sl' THEN coalesce(p."sl_per_year", 6) WHEN 'ol' THEN coalesce(p."ol_per_year", 2) WHEN 'el' THEN coalesce(p."el_per_month", 1) ELSE 0 END,
    v.period, v.carry, v.ol_only, true, v.active, v.sort
  FROM "companies" c
  LEFT JOIN "leave_policies" p ON p."company_id" = c."id"
  CROSS JOIN (VALUES
    ('cl', 'Casual Leave', 'CL', '#2563eb', 'quota', true, 'year', 'none', false, true, 1),
    ('sl', 'Sick Leave', 'SL', '#dc2626', 'quota', true, 'year', 'all', false, true, 2),
    ('ol', 'Optional Leave', 'OL', '#7c3aed', 'quota', true, 'year', 'none', true, true, 3),
    ('el', 'Earned Leave', 'EL', '#16a34a', 'quota', true, 'month', 'none', false, true, 4),
    ('comp_off', 'Comp Off', 'Comp Off', '#f59e0b', 'comp_off', true, 'none', 'none', false, true, 5),
    ('lop', 'Unpaid Leave', 'LOP', '#64748b', 'unpaid', false, 'none', 'none', false, true, 6),
    ('leave', 'Leave', 'Leave', '#94a3b8', 'quota', true, 'none', 'none', false, false, 7)
  ) AS v(code, name, short, color, kind, paid, period, carry, ol_only, active, sort)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "leave_settings" ("company_id", "comp_off_valid_days")
  SELECT c."id", coalesce(p."comp_off_valid_days", 90) FROM "companies" c LEFT JOIN "leave_policies" p ON p."company_id" = c."id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Leave Settings replaces the old Leave Policy page
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT 'leave-settings', 'Leave Settings', '/leave/settings', 'Settings', 9, true, g."id"
  FROM "app_pages" g WHERE g."slug" = 'grp-leave'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", pr."role_id" FROM "app_pages" p
  JOIN "app_page_roles" pr ON pr."page_id" = (SELECT "id" FROM "app_pages" WHERE "slug" = 'leave-policy')
  WHERE p."slug" = 'leave-settings'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr') AND r."company_id" IS NULL
  WHERE p."slug" = 'leave-settings'
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "app_pages" SET "is_active" = false, "show_in_menu" = false WHERE "slug" = 'leave-policy';

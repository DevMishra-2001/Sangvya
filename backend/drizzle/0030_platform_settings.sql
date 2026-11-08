CREATE TABLE "job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" varchar(40) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "mail_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"to_email" varchar(255) NOT NULL,
	"subject" varchar(300) NOT NULL,
	"status" varchar(10) NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "platform_settings_single_row" CHECK ("platform_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "admin_notes" text;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD COLUMN "comp_off_valid_days" smallint DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "mail_log" ADD CONSTRAINT "mail_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_job_runs_job" ON "job_runs" USING btree ("job","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_mail_log_created" ON "mail_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
-- Super Admin pages under Platform (Super Admin sees every page, so no role rows)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT v.slug, v.name, v.url, v.icon, v.sort, true, g."id"
  FROM (VALUES
    ('platform-insights', 'Revenue & usage', '/platform/insights', 'TrendingUp', 7),
    ('platform-health', 'System health', '/platform/health', 'Activity', 8),
    ('platform-broadcast', 'Broadcast', '/platform/broadcast', 'Megaphone', 9),
    ('platform-settings', 'Platform settings', '/platform/settings', 'Settings', 10)
  ) AS v(slug, name, url, icon, sort)
  JOIN "app_pages" g ON g."slug" = 'grp-platform'
ON CONFLICT ("slug") DO NOTHING;

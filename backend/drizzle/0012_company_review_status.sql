ALTER TABLE "companies" ADD COLUMN "verification_notes" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "reviewed_by" integer;--> statement-breakpoint
-- Companies page: Super Admin only (no role grants)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('companies', 'Companies', '/companies', 'Building2', 152, true)
ON CONFLICT ("slug") DO NOTHING;

CREATE TABLE "payroll_settings" (
	"company_id" integer PRIMARY KEY NOT NULL,
	"pf_enabled" boolean DEFAULT true NOT NULL,
	"esi_enabled" boolean DEFAULT true NOT NULL,
	"pt_enabled" boolean DEFAULT true NOT NULL,
	"tds_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "payroll_runs" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN "finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD COLUMN "finalized_by" integer;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "lop_days" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Runs made before drafts existed were final
UPDATE "payroll_runs" SET "status" = 'finalized', "finalized_at" = coalesce("finalized_at", "run_at") WHERE "status" <> 'draft';--> statement-breakpoint
-- My Payslips (everyone)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('my-payslips', 'My Payslips', '/my-payslips', 'Receipt', 92, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr', 'accountant', 'employee')
  WHERE p."slug" = 'my-payslips'
ON CONFLICT DO NOTHING;

CREATE TABLE "report_settings" (
	"company_id" integer PRIMARY KEY NOT NULL,
	"letterhead" boolean DEFAULT true NOT NULL,
	"show_logo" boolean DEFAULT true NOT NULL,
	"show_address" boolean DEFAULT true NOT NULL,
	"show_contact" boolean DEFAULT true NOT NULL,
	"show_tax_ids" boolean DEFAULT false NOT NULL,
	"footer_text" varchar(200),
	"watermark" varchar(40),
	"signature_label" varchar(60),
	"show_generated" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "report_settings" ADD CONSTRAINT "report_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Report & PDF settings page under Reports (Admin)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT 'reports-settings', 'Report settings', '/reports/settings', 'Settings', 99, true, g."id"
  FROM "app_pages" g WHERE g."slug" = 'reports'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" = 'admin'
  WHERE p."slug" = 'reports-settings'
ON CONFLICT DO NOTHING;

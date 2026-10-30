CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_email" varchar(150),
	"company_id" integer,
	"action" varchar(60) NOT NULL,
	"target_type" varchar(40),
	"target_id" integer,
	"summary" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "company_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"module_key" varchar(30) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "company_modules_company_module_key" UNIQUE("company_id","module_key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_modules" ADD CONSTRAINT "company_modules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_company" ON "audit_logs" USING btree ("company_id");--> statement-breakpoint
-- Super Admin pages (no role grants): platform dashboard (first = landing page) and audit log
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu") VALUES
  ('platform-dashboard', 'Platform overview', '/platform', 'Gauge', 140, true),
  ('audit-log', 'Audit log', '/audit-log', 'ListChecks', 159, true)
ON CONFLICT ("slug") DO NOTHING;

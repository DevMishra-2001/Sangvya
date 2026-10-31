CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(20),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100),
	"postal_code" varchar(20),
	"phone" varchar(30),
	"email" varchar(150),
	"latitude" double precision,
	"longitude" double precision,
	"radius_m" integer DEFAULT 200 NOT NULL,
	"geofence_enabled" boolean DEFAULT false NOT NULL,
	"is_head_office" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_private" (
	"employee_id" integer PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"pan" varchar(10),
	"aadhaar" varchar(12),
	"uan" varchar(12),
	"pf_number" varchar(30),
	"esi_number" varchar(17),
	"passport_number" varchar(20),
	"bank_name" varchar(120),
	"bank_branch" varchar(120),
	"ifsc" varchar(11),
	"account_number" varchar(18),
	"account_holder" varchar(150),
	"account_type" varchar(10),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "onboarding_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "onboarding_links_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_contact_relation" varchar(30);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "personal_email" varchar(150);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "marital_status" varchar(10);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "blood_group" varchar(3);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "nationality" varchar(60);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "address_line2" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "state" varchar(100);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "postal_code" varchar(20);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "country" varchar(100);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "branch_id" integer;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "business_unit" varchar(100);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "work_mode" varchar(10);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "probation_end_date" date;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_private" ADD CONSTRAINT "employee_private_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_private" ADD CONSTRAINT "employee_private_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_links" ADD CONSTRAINT "onboarding_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_branches_company" ON "branches" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_branches_name" ON "branches" USING btree ("company_id",lower("name"));--> statement-breakpoint
CREATE INDEX "idx_onboarding_links_employee" ON "onboarding_links" USING btree ("employee_id");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Company settings page (Admin): company details + branches
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
  VALUES ('company-settings', 'Company', '/company', 'Building2', 145, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" = 'admin' AND r."company_id" IS NULL
  WHERE p."slug" = 'company-settings'
ON CONFLICT DO NOTHING;

CREATE TABLE "employee_letters" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"template_id" integer,
	"type" varchar(30) NOT NULL,
	"title" varchar(150) NOT NULL,
	"number" integer,
	"code" varchar(40),
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" varchar(10) DEFAULT 'draft' NOT NULL,
	"pdf_path" text,
	"issued_at" timestamp with time zone,
	"issued_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "letter_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"type" varchar(30) NOT NULL,
	"name" varchar(120) NOT NULL,
	"title" varchar(150),
	"letterhead_path" text,
	"letterhead_name" varchar(255),
	"margin_top" smallint DEFAULT 120 NOT NULL,
	"margin_bottom" smallint DEFAULT 90 NOT NULL,
	"margin_left" smallint DEFAULT 60 NOT NULL,
	"margin_right" smallint DEFAULT 60 NOT NULL,
	"body" jsonb NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signatory_name" varchar(120),
	"signatory_title" varchar(120),
	"signature_path" text,
	"number_prefix" varchar(20) DEFAULT 'HR' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
ALTER TABLE "employee_letters" ADD CONSTRAINT "employee_letters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_letters" ADD CONSTRAINT "employee_letters_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_letters" ADD CONSTRAINT "employee_letters_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."letter_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_letters" ADD CONSTRAINT "employee_letters_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_letters" ADD CONSTRAINT "employee_letters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_letters" ADD CONSTRAINT "employee_letters_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_templates" ADD CONSTRAINT "letter_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_templates" ADD CONSTRAINT "letter_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_templates" ADD CONSTRAINT "letter_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employee_letters_employee" ON "employee_letters" USING btree ("company_id","employee_id");--> statement-breakpoint
CREATE INDEX "idx_employee_letters_type" ON "employee_letters" USING btree ("company_id","type","number");--> statement-breakpoint
CREATE INDEX "idx_letter_templates_company" ON "letter_templates" USING btree ("company_id","type");--> statement-breakpoint
-- Letter templates (Settings), the letters register (People) and My letters (everyone)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT v.slug, v.name, v.url, v.icon, v.sort, true, g."id"
  FROM (VALUES
    ('letter-templates', 'Letter Templates', '/letters/templates', 'FileText', 20, 'grp-settings'),
    ('letters', 'HR Letters', '/letters', 'Mail', 9, 'grp-people')
  ) AS v(slug, name, url, icon, sort, grp)
  JOIN "app_pages" g ON g."slug" = v.grp
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu") VALUES ('my-letters', 'My Letters', '/my-letters', 'Mail', 86, true) ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr') AND r."company_id" IS NULL
  WHERE p."slug" IN ('letter-templates', 'letters')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr', 'accountant', 'employee') AND r."company_id" IS NULL
  WHERE p."slug" = 'my-letters'
ON CONFLICT DO NOTHING;

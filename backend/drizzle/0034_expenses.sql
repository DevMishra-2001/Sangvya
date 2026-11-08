CREATE TABLE "expense_advances" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"advance_type" varchar(10) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"purpose" text NOT NULL,
	"expected_date" date,
	"ifsc" varchar(11),
	"account_number" varchar(18),
	"bank_name" varchar(120),
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"decision_note" text,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"paid_amount" numeric(12, 2),
	"paid_on" date,
	"payment_ref" varchar(80),
	"paid_by" integer,
	"loan_id" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"claim_date" date NOT NULL,
	"trip_name" varchar(150) NOT NULL,
	"country" varchar(80),
	"state" varchar(80),
	"city" varchar(80),
	"locality" varchar(120),
	"client_name" varchar(150),
	"teammates" text,
	"expense_type" varchar(15) DEFAULT 'domestic' NOT NULL,
	"hotel_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"hotel_name" varchar(150),
	"hotel_description" text,
	"breakfast" numeric(12, 2) DEFAULT '0' NOT NULL,
	"lunch" numeric(12, 2) DEFAULT '0' NOT NULL,
	"dinner" numeric(12, 2) DEFAULT '0' NOT NULL,
	"meals_description" text,
	"local_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"intercity_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"entertainment_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"entertainment_description" text,
	"other_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"other_description" text,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(10) DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"decision_note" text,
	"approved_amount" numeric(12, 2),
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"paid_amount" numeric(12, 2),
	"paid_on" date,
	"payment_ref" varchar(80),
	"paid_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_travel_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"claim_id" integer NOT NULL,
	"kind" varchar(10) NOT NULL,
	"travel_type" varchar(12) NOT NULL,
	"from_place" varchar(150),
	"to_place" varchar(150),
	"amount" numeric(12, 2) NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "expense_advances" ADD CONSTRAINT "expense_advances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_advances" ADD CONSTRAINT "expense_advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_advances" ADD CONSTRAINT "expense_advances_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_advances" ADD CONSTRAINT "expense_advances_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_travel_lines" ADD CONSTRAINT "expense_travel_lines_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "public"."expense_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_expense_advances_company" ON "expense_advances" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_expense_advances_employee" ON "expense_advances" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_expense_claims_company" ON "expense_claims" USING btree ("company_id","claim_date");--> statement-breakpoint
CREATE INDEX "idx_expense_claims_employee" ON "expense_claims" USING btree ("employee_id","claim_date");--> statement-breakpoint
CREATE INDEX "idx_expense_travel_claim" ON "expense_travel_lines" USING btree ("claim_id");--> statement-breakpoint
-- Expenses menu group with its three pages (everyone)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('grp-expense', 'Expenses', NULL, 'Receipt', 65, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT v.slug, v.name, v.url, v.icon, v.sort, true, g."id"
  FROM (VALUES
    ('expense-advance', 'Advance Request', '/expenses/advance', 'Wallet', 1),
    ('expense-submit', 'Expense Submission', '/expenses/new', 'Receipt', 2),
    ('expense-view', 'View Expense', '/expenses', 'ClipboardList', 3)
  ) AS v(slug, name, url, icon, sort)
  JOIN "app_pages" g ON g."slug" = 'grp-expense'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr', 'accountant', 'employee') AND r."company_id" IS NULL
  WHERE p."slug" IN ('expense-advance', 'expense-submit', 'expense-view')
ON CONFLICT DO NOTHING;

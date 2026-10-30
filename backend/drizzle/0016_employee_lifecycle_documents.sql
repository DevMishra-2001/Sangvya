CREATE TABLE "employee_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"category" varchar(30) DEFAULT 'other' NOT NULL,
	"file_id" varchar(100) NOT NULL,
	"file_path" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "employment_type" varchar(20) DEFAULT 'full_time' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "exit_date" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "exit_reason" varchar(30);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "exit_notes" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "exited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_contact_name" varchar(150);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "emergency_contact_phone" varchar(30);--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employee_documents_employee" ON "employee_documents" USING btree ("company_id","employee_id");--> statement-breakpoint
-- "My team" for managers (shown in the menu only to people someone reports to)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('my-team', 'My Team', '/my-team', 'Users', 15, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr', 'accountant', 'employee')
  WHERE p."slug" = 'my-team'
ON CONFLICT DO NOTHING;

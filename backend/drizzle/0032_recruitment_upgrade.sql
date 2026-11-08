CREATE TABLE "candidate_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"candidate_id" integer NOT NULL,
	"kind" varchar(12) NOT NULL,
	"text" text NOT NULL,
	"from_stage" varchar(20),
	"to_stage" varchar(20),
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"candidate_id" integer NOT NULL,
	"round_name" varchar(80) NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_min" smallint DEFAULT 45 NOT NULL,
	"mode" varchar(12) NOT NULL,
	"location" text,
	"interviewer_id" integer NOT NULL,
	"status" varchar(12) DEFAULT 'scheduled' NOT NULL,
	"rating" smallint,
	"recommendation" varchar(12),
	"feedback" text,
	"feedback_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "interviews_rating_check" CHECK ("interviews"."rating" IS NULL OR ("interviews"."rating" >= 1 AND "interviews"."rating" <= 5))
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"candidate_id" integer NOT NULL,
	"designation" varchar(150) NOT NULL,
	"department" varchar(100),
	"ctc_annual" numeric(12, 2) NOT NULL,
	"joining_date" date NOT NULL,
	"expires_on" date,
	"work_location" varchar(150),
	"probation_months" smallint,
	"notes" text,
	"status" varchar(12) DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "offers_candidate_key" UNIQUE("candidate_id")
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "source" varchar(20);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "current_company" varchar(150);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "experience_years" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "current_ctc" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "expected_ctc" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "notice_days" smallint;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "location" varchar(100);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "rating" smallint;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "stage_changed_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "resume_path" text;--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "resume_name" varchar(255);--> statement-breakpoint
ALTER TABLE "candidates" ADD COLUMN "hired_employee_id" integer;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "employment_type" varchar(20);--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "experience_min" smallint;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "experience_max" smallint;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "salary_min" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "salary_max" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "openings" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "skills" text;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "hiring_manager_id" integer;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "closes_on" date;--> statement-breakpoint
ALTER TABLE "job_postings" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_events" ADD CONSTRAINT "candidate_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_interviewer_id_fkey" FOREIGN KEY ("interviewer_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_candidate_events_candidate" ON "candidate_events" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "idx_interviews_company_time" ON "interviews" USING btree ("company_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_interviews_interviewer" ON "interviews" USING btree ("interviewer_id","status");--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_hired_employee_id_fkey" FOREIGN KEY ("hired_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_hiring_manager_id_fkey" FOREIGN KEY ("hiring_manager_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- "My interviews": for anyone who interviews candidates (hidden from the menu, opened from the notification)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('my-interviews', 'My interviews', '/my-interviews', 'Briefcase', 75, false)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr', 'accountant', 'employee') AND r."company_id" IS NULL
  WHERE p."slug" = 'my-interviews'
ON CONFLICT DO NOTHING;

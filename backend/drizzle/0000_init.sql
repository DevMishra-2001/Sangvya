CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"industry" varchar(100),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "designations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"designation_id" integer,
	"department" varchar(100),
	"email" varchar(150),
	"join_date" date,
	"salary" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now(),
	"manager_id" integer,
	"date_of_birth" date,
	"ol_quota" numeric(5, 1),
	"employee_code" varchar(40)
);
--> statement-breakpoint
CREATE TABLE "company_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "company_members_user_id_company_id_key" UNIQUE("user_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"otp_hash" text NOT NULL,
	"otp_expires_at" timestamp with time zone NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"reset_token_hash" text,
	"reset_expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"previous_token_hash" text,
	"rotated_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"name" varchar(150) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password_hash" text NOT NULL,
	"role" varchar(30) DEFAULT 'employee' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"employee_id" integer,
	"font_size" smallint DEFAULT 13 NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_font_size_check" CHECK ("users"."font_size" >= 10 AND "users"."font_size" <= 17)
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"date" date NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"punch_in" timestamp with time zone,
	"punch_out" timestamp with time zone,
	"punch_in_location" varchar(40),
	"punch_in_remarks" text,
	"punch_out_location" varchar(40),
	"punch_out_remarks" text,
	"day_closed_at" timestamp with time zone,
	CONSTRAINT "attendance_employee_id_date_key" UNIQUE("employee_id","date")
);
--> statement-breakpoint
CREATE TABLE "attendance_breaks" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"attendance_id" integer NOT NULL,
	"break_start" timestamp with time zone NOT NULL,
	"break_end" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attendance_punches" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"attendance_id" integer NOT NULL,
	"kind" varchar(3) NOT NULL,
	"punched_at" timestamp with time zone NOT NULL,
	"location" varchar(40),
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "attendance_punches_kind_check" CHECK ("attendance_punches"."kind" IN ('in', 'out'))
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"date" date NOT NULL,
	"name" varchar(150) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "holidays_company_id_date_key" UNIQUE("company_id","date")
);
--> statement-breakpoint
CREATE TABLE "leave_policies" (
	"company_id" integer PRIMARY KEY NOT NULL,
	"cl_per_year" numeric(5, 1) DEFAULT '6' NOT NULL,
	"sl_per_year" numeric(5, 1) DEFAULT '6' NOT NULL,
	"ol_per_year" numeric(5, 1) DEFAULT '2' NOT NULL,
	"el_per_month" numeric(5, 1) DEFAULT '1' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"leave_type" varchar(20) DEFAULT 'leave' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payroll_runs_company_id_month_year_key" UNIQUE("company_id","month","year")
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"basic" numeric(12, 2) NOT NULL,
	"hra" numeric(12, 2) NOT NULL,
	"allowances" numeric(12, 2) NOT NULL,
	"gross" numeric(12, 2) NOT NULL,
	"paid_days" numeric(5, 2) NOT NULL,
	"total_days" integer NOT NULL,
	"pf_employee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pf_employer" numeric(12, 2) DEFAULT '0' NOT NULL,
	"esi_employee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"esi_employer" numeric(12, 2) DEFAULT '0' NOT NULL,
	"professional_tax" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tds" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_deductions" numeric(12, 2) NOT NULL,
	"net_pay" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payslips_payroll_run_id_employee_id_key" UNIQUE("payroll_run_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "salary_structures" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"basic" numeric(12, 2) NOT NULL,
	"hra" numeric(12, 2) DEFAULT '0' NOT NULL,
	"allowances" numeric(12, 2) DEFAULT '0' NOT NULL,
	"effective_from" date DEFAULT CURRENT_DATE NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"job_posting_id" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"email" varchar(150),
	"phone" varchar(30),
	"resume_url" text,
	"stage" varchar(20) DEFAULT 'applied' NOT NULL,
	"notes" text,
	"applied_date" date DEFAULT CURRENT_DATE NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_postings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" varchar(150) NOT NULL,
	"department" varchar(100),
	"location" varchar(100),
	"description" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"cycle_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"rating" smallint,
	"strengths" text,
	"improvements" text,
	"goals_next_cycle" text,
	"manager_comments" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "performance_reviews_cycle_id_employee_id_key" UNIQUE("cycle_id","employee_id"),
	CONSTRAINT "performance_reviews_rating_check" CHECK ("performance_reviews"."rating" >= 1 AND "performance_reviews"."rating" <= 5)
);
--> statement-breakpoint
CREATE TABLE "review_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"razorpay_payment_id" varchar(100),
	"razorpay_invoice_id" varchar(100),
	"amount" numeric(12, 2) NOT NULL,
	"employee_count" integer NOT NULL,
	"status" varchar(20) NOT NULL,
	"billing_month" integer,
	"billing_year" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"razorpay_customer_id" varchar(100),
	"razorpay_subscription_id" varchar(100),
	"razorpay_plan_id" varchar(100),
	"price_per_employee" numeric(10, 2) DEFAULT '15.00' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "subscriptions_company_id_key" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"razorpay_event_id" varchar(150),
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "webhook_events_razorpay_event_id_key" UNIQUE("razorpay_event_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"priority" varchar(10) DEFAULT 'medium' NOT NULL,
	"status" varchar(20) DEFAULT 'todo' NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"assigned_to" integer NOT NULL,
	"assigned_by" integer,
	"assigned_date" date DEFAULT CURRENT_DATE NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "tasks_progress_check" CHECK ("tasks"."progress" >= 0 AND "tasks"."progress" <= 100)
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "designations" ADD CONSTRAINT "designations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_designation_id_fkey" FOREIGN KEY ("designation_id") REFERENCES "public"."designations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_breaks" ADD CONSTRAINT "attendance_breaks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_breaks" ADD CONSTRAINT "attendance_breaks_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "public"."attendance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_structures" ADD CONSTRAINT "salary_structures_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "public"."job_postings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."review_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD CONSTRAINT "review_cycles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_designations_company" ON "designations" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_designations_name" ON "designations" USING btree ("company_id",lower("name"));--> statement-breakpoint
CREATE INDEX "idx_employees_company" ON "employees" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_employees_code" ON "employees" USING btree ("company_id",lower("employee_code")) WHERE "employees"."employee_code" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_company_members_company" ON "company_members" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_password_resets_user" ON "password_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_resets_token" ON "password_resets" USING btree ("reset_token_hash");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_token" ON "user_sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_prev" ON "user_sessions" USING btree ("previous_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_employee" ON "users" USING btree ("employee_id") WHERE "users"."employee_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_attendance_company_date" ON "attendance" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "idx_attendance_breaks_attendance" ON "attendance_breaks" USING btree ("attendance_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_punches" ON "attendance_punches" USING btree ("attendance_id","punched_at");--> statement-breakpoint
CREATE INDEX "idx_leave_company_status" ON "leave_requests" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_payslips_company_run" ON "payslips" USING btree ("company_id","payroll_run_id");--> statement-breakpoint
CREATE INDEX "idx_salary_structures_employee" ON "salary_structures" USING btree ("employee_id","effective_from" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_candidates_company_job" ON "candidates" USING btree ("company_id","job_posting_id");--> statement-breakpoint
CREATE INDEX "idx_candidates_stage" ON "candidates" USING btree ("company_id","stage");--> statement-breakpoint
CREATE INDEX "idx_job_postings_company" ON "job_postings" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_perf_reviews_company_cycle" ON "performance_reviews" USING btree ("company_id","cycle_id");--> statement-breakpoint
CREATE INDEX "idx_perf_reviews_employee" ON "performance_reviews" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_review_cycles_company" ON "review_cycles" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_invoices_company" ON "invoices" USING btree ("company_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "idx_subscriptions_razorpay_sub" ON "subscriptions" USING btree ("razorpay_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_assignee" ON "tasks" USING btree ("company_id","assigned_to");--> statement-breakpoint
CREATE INDEX "idx_tasks_assigner" ON "tasks" USING btree ("company_id","assigned_by");--> statement-breakpoint
CREATE INDEX "idx_announcements_company" ON "announcements" USING btree ("company_id","created_at" DESC NULLS FIRST);
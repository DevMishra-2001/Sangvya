CREATE TABLE "employee_loans" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" varchar(15) NOT NULL,
	"principal" numeric(12, 2) NOT NULL,
	"emi" numeric(12, 2) NOT NULL,
	"start_month" varchar(7) NOT NULL,
	"recovered" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" varchar(10) DEFAULT 'active' NOT NULL,
	"reason" text,
	"source_type" varchar(20),
	"source_id" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "loan_recoveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"loan_id" integer NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "loan_recoveries_loan_run_key" UNIQUE("loan_id","payroll_run_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"kind" varchar(10) NOT NULL,
	"category" varchar(30) NOT NULL,
	"label" varchar(120) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"source_type" varchar(20),
	"source_id" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_lop_overrides" (
	"payroll_run_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"lop_days" numeric(5, 2) NOT NULL,
	"note" text,
	CONSTRAINT "payroll_lop_overrides_payroll_run_id_employee_id_pk" PRIMARY KEY("payroll_run_id","employee_id")
);
--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "pf_ceiling" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_settings" ADD COLUMN "ctc_template" jsonb;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "earnings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "additions" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "addition_lines" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "reimbursements" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "other_deductions" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN "deduction_lines" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "salary_structures" ADD COLUMN "components" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "salary_structures" ADD COLUMN "ctc_annual" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "salary_structures" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "salary_structures" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_loans" ADD CONSTRAINT "employee_loans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_recoveries" ADD CONSTRAINT "loan_recoveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_recoveries" ADD CONSTRAINT "loan_recoveries_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "public"."employee_loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_recoveries" ADD CONSTRAINT "loan_recoveries_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lop_overrides" ADD CONSTRAINT "payroll_lop_overrides_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lop_overrides" ADD CONSTRAINT "payroll_lop_overrides_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_employee_loans_company" ON "employee_loans" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "idx_payroll_adjustments_run" ON "payroll_adjustments" USING btree ("payroll_run_id");
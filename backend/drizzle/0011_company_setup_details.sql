ALTER TABLE "companies" ADD COLUMN "legal_name" varchar(200);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_type" varchar(30);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "year_established" smallint;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "office_locations" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "timezone" varchar(60);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "pan" varchar(10);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "gstin" varchar(15);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "cin_llpin" varchar(21);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "tan" varchar(10);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "billing_address" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "verification_status" varchar(20) DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "work_days" varchar(30);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "office_start" varchar(5);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "office_end" varchar(5);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "attendance_mode" varchar(20);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "leave_year" varchar(20);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "fiscal_year_start" smallint;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "employee_id_prefix" varchar(10);
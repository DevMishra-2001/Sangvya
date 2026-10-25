ALTER TABLE "companies" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "employee_range" varchar(20);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website" varchar(200);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "email" varchar(150);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "city" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "state" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "country" varchar(100);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "postal_code" varchar(20);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD COLUMN "accuracy_m" integer;--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD COLUMN "photo_url" text;
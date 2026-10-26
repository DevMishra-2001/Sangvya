ALTER TABLE "employees" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "gender" varchar(10);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_blocked" boolean DEFAULT false NOT NULL;
ALTER TABLE "leave_requests" ADD COLUMN "half_day" varchar(10);--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "cancelled_by" integer;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
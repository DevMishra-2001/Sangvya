ALTER TABLE "letter_templates" ADD COLUMN "letterhead_mode" varchar(10) DEFAULT 'company' NOT NULL;--> statement-breakpoint
ALTER TABLE "letter_templates" ADD COLUMN "page_numbers" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Templates that already have their own letterhead keep it
UPDATE "letter_templates" SET "letterhead_mode" = 'upload' WHERE "letterhead_path" IS NOT NULL;

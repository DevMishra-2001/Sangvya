ALTER TABLE "app_page_access" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "app_page_access" CASCADE;--> statement-breakpoint
DROP INDEX "idx_designations_key";--> statement-breakpoint
ALTER TABLE "designations" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "designations" DROP COLUMN "level";
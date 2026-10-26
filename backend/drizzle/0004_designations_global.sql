ALTER TABLE "designations" DROP CONSTRAINT "designations_company_id_fkey";
--> statement-breakpoint
ALTER TABLE "designations" DROP COLUMN "company_id";
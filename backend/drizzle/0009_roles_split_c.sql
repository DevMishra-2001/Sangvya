ALTER TABLE "designations" ADD COLUMN "company_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "designations" ADD CONSTRAINT "designations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_designations_company" ON "designations" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_designations_name" ON "designations" USING btree ("company_id",lower("name"));
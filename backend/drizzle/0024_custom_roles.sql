DROP INDEX "idx_roles_key";--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "company_id" integer;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "description" varchar(200);--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roles_company_name" ON "roles" USING btree ("company_id",lower("name")) WHERE "roles"."company_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_roles_key" ON "roles" USING btree ("key") WHERE "roles"."company_id" IS NULL;--> statement-breakpoint
-- Custom Roles page (company Admin), next to Users & Roles
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
  VALUES ('custom-roles', 'Custom Roles', '/custom-roles', 'UserCog', 151, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" = 'admin' AND r."company_id" IS NULL
  WHERE p."slug" = 'custom-roles'
ON CONFLICT DO NOTHING;

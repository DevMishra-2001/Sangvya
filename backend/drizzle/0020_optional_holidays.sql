ALTER TABLE "holidays" ADD COLUMN "is_optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Holidays (read-only) under My Attendance, for everyone
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT 'my-attendance-holidays', 'Holidays', '/my-attendance/holidays', 'PartyPopper', 6, true, g."id"
  FROM "app_pages" g WHERE g."slug" = 'my-attendance'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr', 'accountant', 'employee')
  WHERE p."slug" = 'my-attendance-holidays'
ON CONFLICT DO NOTHING;

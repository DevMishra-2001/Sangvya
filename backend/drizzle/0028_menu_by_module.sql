-- Menu by module: groups (pages without a URL) and the Org Chart page. Moves / renames pages by slug; nothing is deleted.
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu") VALUES
  ('grp-organisation', 'Organisation', NULL, 'Building2', 20, true),
  ('grp-people', 'People', NULL, 'Users', 30, true),
  ('grp-leave', 'Leave', NULL, 'CalendarClock', 50, true),
  ('grp-payroll', 'Payroll', NULL, 'Wallet', 60, true),
  ('grp-settings', 'Settings', NULL, 'Settings', 150, true),
  ('grp-platform', 'Platform', NULL, 'Gauge', 200, true),
  ('org-chart', 'Org Chart', '/org-chart', 'Network', 2, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
-- Org Chart: everyone with a company role
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr', 'accountant', 'employee') AND r."company_id" IS NULL
  WHERE p."slug" = 'org-chart'
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Clearer names now that pages sit under their module
UPDATE "app_pages" p SET "name" = v.name
  FROM (VALUES
    ('my-attendance', 'Attendance'), ('my-attendance-today', 'My Attendance'), ('my-attendance-calendar', 'Calendar'), ('my-attendance-report', 'Monthly Report'),
    ('leave', 'Leave Requests'), ('my-attendance-leaves', 'My Leaves'), ('my-attendance-holidays', 'Holiday List')
  ) AS v(slug, name)
  WHERE p."slug" = v.slug;--> statement-breakpoint
-- Top level, in this order
UPDATE "app_pages" p SET "parent_id" = NULL, "sort_order" = v.sort
  FROM (VALUES ('dashboard', 10), ('my-attendance', 40), ('recruitment', 70), ('performance', 80), ('tickets', 90), ('reports', 100)) AS v(slug, sort)
  WHERE p."slug" = v.slug;--> statement-breakpoint
-- Into their groups
UPDATE "app_pages" p SET "parent_id" = g."id", "sort_order" = v.sort
  FROM (VALUES
    ('company-settings', 'grp-organisation', 1), ('departments', 'grp-organisation', 2), ('designations', 'grp-organisation', 3), ('holidays', 'grp-organisation', 4),
    ('employees', 'grp-people', 1), ('org-chart', 'grp-people', 2), ('my-team', 'grp-people', 3),
    ('my-attendance-today', 'my-attendance', 1), ('my-attendance-calendar', 'my-attendance', 2), ('my-attendance-report', 'my-attendance', 3),
    ('my-attendance-corrections', 'my-attendance', 4), ('attendance', 'my-attendance', 5), ('shifts', 'my-attendance', 6),
    ('leave', 'grp-leave', 1), ('my-attendance-leaves', 'grp-leave', 2), ('my-attendance-holidays', 'grp-leave', 3), ('leave-policy', 'grp-leave', 4),
    ('payroll', 'grp-payroll', 1), ('my-payslips', 'grp-payroll', 2),
    ('users', 'grp-settings', 1), ('custom-roles', 'grp-settings', 2), ('billing', 'grp-settings', 3), ('change-password', 'grp-settings', 4),
    ('platform-dashboard', 'grp-platform', 1), ('companies', 'grp-platform', 2), ('admins', 'grp-platform', 3),
    ('roles', 'grp-platform', 4), ('audit-log', 'grp-platform', 5), ('page-master', 'grp-platform', 6)
  ) AS v(slug, grp, sort)
  JOIN "app_pages" g ON g."slug" = v.grp
  WHERE p."slug" = v.slug;

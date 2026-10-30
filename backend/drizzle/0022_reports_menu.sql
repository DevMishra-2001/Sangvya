-- Reports menu group; each report is a page under it
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('reports', 'Reports', NULL, 'FileBarChart', 135, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT v.slug, v.name, v.url, v.icon, v.sort, true, g."id"
  FROM (VALUES
    ('reports-attendance-register', 'Attendance register', '/reports/attendance-register', 'CalendarCheck', 1),
    ('reports-late-arrivals', 'Late arrivals', '/reports/late-arrivals', 'Timer', 2),
    ('reports-leave-requests', 'Leave requests', '/reports/leave-requests', 'CalendarClock', 3),
    ('reports-leave-balances', 'Leave balances', '/reports/leave-balances', 'Scale', 4),
    ('reports-payroll-register', 'Payroll register', '/reports/payroll-register', 'Wallet', 5),
    ('reports-employee-master', 'Employee master', '/reports/employee-master', 'Users', 6)
  ) AS v(slug, name, url, icon, sort)
  CROSS JOIN "app_pages" g WHERE g."slug" = 'reports'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr')
  WHERE p."slug" LIKE 'reports-%' OR p."slug" = 'reports'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" = 'accountant'
  WHERE p."slug" IN ('reports', 'reports-payroll-register')
ON CONFLICT DO NOTHING;

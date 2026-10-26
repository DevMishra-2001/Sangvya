-- Admins page (Super Admin only — no designation grants): create company-owner logins.
-- Public signup is gone; an Admin registers their company on first login.
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('admins', 'Admins', '/admins', 'UserCog', 155, true)
ON CONFLICT ("slug") DO NOTHING;

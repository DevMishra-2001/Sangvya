-- Letters menu group: HR Letters, Letter Templates, My Letters (one module the Super Admin can switch off)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu") VALUES ('grp-letters', 'Letters', NULL, 'Mail', 86, true) ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
UPDATE "app_pages" p SET "parent_id" = g."id", "name" = v.name, "icon" = v.icon, "sort_order" = v.sort
  FROM (VALUES
    ('letters', 'HR Letters', 'ClipboardList', 1),
    ('letter-templates', 'Letter Templates', 'FileText', 2),
    ('my-letters', 'My Letters', 'Mail', 3)
  ) AS v(slug, name, icon, sort), "app_pages" g
  WHERE g."slug" = 'grp-letters' AND p."slug" = v.slug;

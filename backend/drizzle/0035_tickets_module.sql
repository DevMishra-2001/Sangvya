CREATE TABLE "ticket_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(9) DEFAULT '#64748b' NOT NULL,
	"default_days" smallint,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "ticket_categories_company_name_key" UNIQUE("company_id","name")
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"ticket_id" integer NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"ticket_id" integer NOT NULL,
	"kind" varchar(12) NOT NULL,
	"text" text NOT NULL,
	"meta" jsonb,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "ticket_modules_project_name_key" UNIQUE("project_id","name")
);
--> statement-breakpoint
CREATE TABLE "ticket_priorities" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(9) DEFAULT '#64748b' NOT NULL,
	"sla_hours" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "ticket_priorities_company_name_key" UNIQUE("company_id","name")
);
--> statement-breakpoint
CREATE TABLE "ticket_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"code" varchar(20),
	"client_name" varchar(150),
	"version" varchar(50),
	"description" text,
	"default_assignee_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "ticket_projects_company_name_key" UNIQUE("company_id","name")
);
--> statement-breakpoint
CREATE TABLE "ticket_settings" (
	"company_id" integer PRIMARY KEY NOT NULL,
	"prefix" varchar(10) DEFAULT 'TKT-' NOT NULL,
	"number_digits" smallint DEFAULT 4 NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"who_can_create" varchar(10) DEFAULT 'everyone' NOT NULL,
	"assign_anyone" boolean DEFAULT true NOT NULL,
	"allow_self_assign" boolean DEFAULT true NOT NULL,
	"require_project" boolean DEFAULT false NOT NULL,
	"require_time_on_done" boolean DEFAULT false NOT NULL,
	"auto_close_days" smallint,
	"notify_on_assign" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "ticket_statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(9) DEFAULT '#64748b' NOT NULL,
	"kind" varchar(10) DEFAULT 'open' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "ticket_statuses_company_name_key" UNIQUE("company_id","name")
);
--> statement-breakpoint
CREATE TABLE "ticket_time_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"ticket_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"work_date" date NOT NULL,
	"minutes" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"number" integer NOT NULL,
	"code" varchar(30) NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"project_id" integer,
	"module_id" integer,
	"category_id" integer,
	"priority_id" integer,
	"status_id" integer NOT NULL,
	"assigned_to" integer,
	"secondary_assignee" integer,
	"reported_by_name" varchar(120),
	"reported_by_mobile" varchar(20),
	"page_url" varchar(500),
	"due_date" date,
	"estimate_minutes" integer,
	"spent_minutes" integer DEFAULT 0 NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" integer,
	"updated_at" timestamp with time zone DEFAULT now(),
	"updated_by" integer,
	CONSTRAINT "tickets_company_number_key" UNIQUE("company_id","number")
);
--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_categories" ADD CONSTRAINT "ticket_categories_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_modules" ADD CONSTRAINT "ticket_modules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_modules" ADD CONSTRAINT "ticket_modules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."ticket_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_modules" ADD CONSTRAINT "ticket_modules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_modules" ADD CONSTRAINT "ticket_modules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_priorities" ADD CONSTRAINT "ticket_priorities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_priorities" ADD CONSTRAINT "ticket_priorities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_priorities" ADD CONSTRAINT "ticket_priorities_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_projects" ADD CONSTRAINT "ticket_projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_projects" ADD CONSTRAINT "ticket_projects_default_assignee_id_fkey" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_projects" ADD CONSTRAINT "ticket_projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_projects" ADD CONSTRAINT "ticket_projects_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_settings" ADD CONSTRAINT "ticket_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_settings" ADD CONSTRAINT "ticket_settings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_settings" ADD CONSTRAINT "ticket_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_statuses" ADD CONSTRAINT "ticket_statuses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_statuses" ADD CONSTRAINT "ticket_statuses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_statuses" ADD CONSTRAINT "ticket_statuses_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_time_logs" ADD CONSTRAINT "ticket_time_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_time_logs" ADD CONSTRAINT "ticket_time_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_time_logs" ADD CONSTRAINT "ticket_time_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_time_logs" ADD CONSTRAINT "ticket_time_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_time_logs" ADD CONSTRAINT "ticket_time_logs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."ticket_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."ticket_modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."ticket_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "public"."ticket_priorities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."ticket_statuses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_secondary_assignee_fkey" FOREIGN KEY ("secondary_assignee") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ticket_comments_ticket" ON "ticket_comments" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_events_ticket" ON "ticket_events" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_ticket_time_employee_date" ON "ticket_time_logs" USING btree ("company_id","employee_id","work_date");--> statement-breakpoint
CREATE INDEX "idx_ticket_time_ticket" ON "ticket_time_logs" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_company_status" ON "tickets" USING btree ("company_id","status_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_assignee" ON "tickets" USING btree ("company_id","assigned_to");--> statement-breakpoint
CREATE INDEX "idx_tickets_due" ON "tickets" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_tickets_created" ON "tickets" USING btree ("company_id","created_at");--> statement-breakpoint
-- Default settings, statuses, priorities and categories for every existing company (new companies get them on first use)
INSERT INTO "ticket_settings" ("company_id") SELECT "id" FROM "companies" ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "ticket_statuses" ("company_id", "name", "color", "kind", "is_default", "sort_order")
  SELECT c."id", v.name, v.color, v.kind, v.is_default, v.sort
  FROM "companies" c CROSS JOIN (VALUES
    ('Assigned', '#2563eb', 'open', true, 1), ('Scheduled', '#0891b2', 'open', false, 2), ('In Progress', '#7c3aed', 'active', false, 3),
    ('On Hold', '#f59e0b', 'hold', false, 4), ('In Review', '#db2777', 'review', false, 5), ('Done', '#16a34a', 'done', false, 6), ('Closed', '#475569', 'closed', false, 7)
  ) AS v(name, color, kind, is_default, sort)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "ticket_priorities" ("company_id", "name", "color", "sla_hours", "is_default", "sort_order")
  SELECT c."id", v.name, v.color, v.sla, v.is_default, v.sort
  FROM "companies" c CROSS JOIN (VALUES ('Low', '#64748b', 72, false, 1), ('Normal', '#2563eb', 48, true, 2), ('High', '#f59e0b', 24, false, 3), ('Critical', '#dc2626', 4, false, 4)) AS v(name, color, sla, is_default, sort)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "ticket_categories" ("company_id", "name", "color", "default_days", "sort_order")
  SELECT c."id", v.name, v.color, v.days, v.sort
  FROM "companies" c CROSS JOIN (VALUES ('Bug', '#dc2626', 2, 1), ('Modification', '#7c3aed', 5, 2), ('Support', '#0891b2', 1, 3), ('Training', '#f59e0b', 3, 4), ('New Feature', '#16a34a', 10, 5)) AS v(name, color, days, sort)
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Old tasks become tickets (the tasks table stays as it was)
INSERT INTO "tickets" ("company_id", "number", "code", "title", "description", "priority_id", "status_id", "assigned_to", "due_date", "resolved_at", "closed_at", "created_by", "created_at", "updated_by", "updated_at")
  SELECT t."company_id", t.rn, 'TKT-' || lpad(t.rn::text, 4, '0'), t."title", t."description",
    (SELECT p."id" FROM "ticket_priorities" p WHERE p."company_id" = t."company_id" AND p."name" = CASE t."priority" WHEN 'low' THEN 'Low' WHEN 'high' THEN 'High' ELSE 'Normal' END),
    (SELECT s."id" FROM "ticket_statuses" s WHERE s."company_id" = t."company_id" AND s."name" = CASE t."status" WHEN 'in_progress' THEN 'In Progress' WHEN 'done' THEN 'Done' WHEN 'approved' THEN 'Closed' ELSE 'Assigned' END),
    t."assigned_to", t."due_date", t."completed_at", t."approved_at", t."assigned_by", t."created_at", COALESCE(t."approved_by", t."assigned_by"), COALESCE(t."updated_at", t."created_at")
  FROM (SELECT *, row_number() OVER (PARTITION BY "company_id" ORDER BY "id")::int AS rn FROM "tasks") t;--> statement-breakpoint
INSERT INTO "ticket_events" ("company_id", "ticket_id", "kind", "text", "created_by", "created_at")
  SELECT "company_id", "id", 'created', 'Ticket created', "created_by", "created_at" FROM "tickets";--> statement-breakpoint
UPDATE "ticket_settings" s SET "next_number" = m.n + 1 FROM (SELECT "company_id", max("number") AS n FROM "tickets" GROUP BY "company_id") m WHERE m."company_id" = s."company_id";--> statement-breakpoint
-- Tickets menu group: New Ticket, View Tickets (the old page), Task Tracker, Ticket Calendar, Ticket Settings
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu") VALUES ('grp-tickets', 'Tickets', NULL, 'Ticket', 90, true) ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
UPDATE "app_pages" SET "name" = 'View Tickets', "icon" = 'LayoutList', "sort_order" = 2, "parent_id" = (SELECT "id" FROM "app_pages" WHERE "slug" = 'grp-tickets') WHERE "slug" = 'tickets';--> statement-breakpoint
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu", "parent_id")
  SELECT v.slug, v.name, v.url, v.icon, v.sort, true, g."id"
  FROM (VALUES
    ('ticket-new', 'New Ticket', '/tickets/new', 'FileText', 1),
    ('ticket-board', 'Task Tracker', '/tickets/board', 'FolderKanban', 3),
    ('ticket-calendar', 'Ticket Calendar', '/tickets/calendar', 'CalendarDays', 4),
    ('ticket-settings', 'Ticket Settings', '/tickets/settings', 'Settings', 5)
  ) AS v(slug, name, url, icon, sort)
  JOIN "app_pages" g ON g."slug" = 'grp-tickets'
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
-- Same people as the old Tickets page; settings for Admin and HR only
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", pr."role_id" FROM "app_pages" p
  JOIN "app_page_roles" pr ON pr."page_id" = (SELECT "id" FROM "app_pages" WHERE "slug" = 'tickets')
  WHERE p."slug" IN ('ticket-new', 'ticket-board', 'ticket-calendar')
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr') AND r."company_id" IS NULL
  WHERE p."slug" = 'ticket-settings'
ON CONFLICT DO NOTHING;

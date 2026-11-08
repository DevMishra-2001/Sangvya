CREATE TABLE "goal_checkins" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"goal_id" integer NOT NULL,
	"progress" smallint NOT NULL,
	"status" varchar(12) NOT NULL,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "performance_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"review_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"target" varchar(200),
	"weight" smallint DEFAULT 20 NOT NULL,
	"progress" smallint DEFAULT 0 NOT NULL,
	"status" varchar(12) DEFAULT 'on_track' NOT NULL,
	"self_rating" smallint,
	"manager_rating" smallint,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "performance_reviews" ALTER COLUMN "status" SET DEFAULT 'pending_self';--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "manager_id" integer;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "self_rating" smallint;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "self_comments" text;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "self_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "manager_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "competency_ratings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "score" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "final_rating" smallint;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "hr_comments" text;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "finalized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD COLUMN "employee_comment" text;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "self_review" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "self_due" date;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "manager_due" date;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "goals_weight" smallint DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "competencies" jsonb DEFAULT '["Quality of work","Ownership","Communication","Teamwork","Learning"]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "launched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "goal_checkins" ADD CONSTRAINT "goal_checkins_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_checkins" ADD CONSTRAINT "goal_checkins_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."performance_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_checkins" ADD CONSTRAINT "goal_checkins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."performance_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_goal_checkins_goal" ON "goal_checkins" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_perf_goals_review" ON "performance_goals" USING btree ("review_id");--> statement-breakpoint
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_cycles" ADD CONSTRAINT "review_cycles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_perf_reviews_manager" ON "performance_reviews" USING btree ("manager_id");--> statement-breakpoint
-- Old statuses → the new flow; cycles made before launch-tracking count as launched
UPDATE "performance_reviews" SET "status" = 'pending_manager' WHERE "status" = 'draft';--> statement-breakpoint
UPDATE "performance_reviews" SET "status" = 'finalized', "final_rating" = "rating", "finalized_at" = now() WHERE "status" = 'submitted';--> statement-breakpoint
UPDATE "review_cycles" SET "launched_at" = "created_at" WHERE "launched_at" IS NULL AND EXISTS (SELECT 1 FROM "performance_reviews" r WHERE r."cycle_id" = "review_cycles"."id");--> statement-breakpoint
-- "My performance" for everyone (own review, and the team's for managers)
INSERT INTO "app_pages" ("slug", "name", "url", "icon", "sort_order", "show_in_menu")
VALUES ('my-performance', 'My performance', '/my-performance', 'Star', 79, true)
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "app_page_roles" ("page_id", "role_id")
  SELECT p."id", r."id" FROM "app_pages" p JOIN "roles" r ON r."key" IN ('admin', 'hr', 'accountant', 'employee') AND r."company_id" IS NULL
  WHERE p."slug" = 'my-performance'
ON CONFLICT DO NOTHING;

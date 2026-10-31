ALTER TABLE "users" ADD COLUMN "theme" varchar(10) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "accent" varchar(12) DEFAULT 'blue' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "menu_layout" varchar(12) DEFAULT 'vertical' NOT NULL;
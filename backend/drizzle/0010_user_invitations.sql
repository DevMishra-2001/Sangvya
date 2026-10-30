CREATE TABLE "user_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"purpose" varchar(20) DEFAULT 'admin' NOT NULL,
	"company_name" varchar(200),
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"invited_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_invitations_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_invitations_user" ON "user_invitations" USING btree ("user_id");--> statement-breakpoint
-- Everyone who already has a login has set a password
UPDATE "users" SET "activated_at" = COALESCE("created_at", now()) WHERE "activated_at" IS NULL;

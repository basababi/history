CREATE TABLE "stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"era_id" integer NOT NULL,
	"title" varchar(120) NOT NULL,
	"summary" text NOT NULL,
	"source_ref" text NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"xp_reward" integer DEFAULT 40 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"story_id" integer NOT NULL,
	"ending_key" varchar(40) NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"key" varchar(40) NOT NULL,
	"body" text NOT NULL,
	"choices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ending_label" varchar(60)
);
--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_completions" ADD CONSTRAINT "story_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_completions" ADD CONSTRAINT "story_completions_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_nodes" ADD CONSTRAINT "story_nodes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stories_status_idx" ON "stories" USING btree ("status","era_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_completions_uq" ON "story_completions" USING btree ("user_id","story_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_nodes_uq" ON "story_nodes" USING btree ("story_id","key");
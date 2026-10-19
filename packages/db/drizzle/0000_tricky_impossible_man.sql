CREATE TABLE IF NOT EXISTS "artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"era_id" integer NOT NULL,
	"rarity" varchar(16) NOT NULL,
	"model_url" text,
	"emoji" varchar(16),
	"description" text NOT NULL,
	"source_ref" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"response_ms" integer NOT NULL,
	"confidence_level" integer,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"reviewer_id" integer,
	"verdict" varchar(24) NOT NULL,
	"note" text,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eras" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"order_index" integer NOT NULL,
	"start_year" varchar(60),
	"end_year" varchar(60),
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "heroes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"era_id" integer NOT NULL,
	"rank_tier" varchar(16) NOT NULL,
	"rarity" varchar(16) DEFAULT 'common' NOT NULL,
	"perk" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"art_url" text,
	"lore" text NOT NULL,
	"source_ref" text NOT NULL,
	"chronological_order" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_hero_id" integer NOT NULL,
	"era_id" integer,
	"keywords" jsonb NOT NULL,
	"text" text NOT NULL,
	"source_ref" text NOT NULL,
	"status" varchar(16) DEFAULT 'published' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "league_members" (
	"league_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"weekly_xp" integer DEFAULT 0 NOT NULL,
	"final_rank" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leagues" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_key" varchar(12) NOT NULL,
	"tier" varchar(16) NOT NULL,
	"bucket_no" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mentor_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_hero_id" integer NOT NULL,
	"query_hash" varchar(64) NOT NULL,
	"answer" text NOT NULL,
	"sources" jsonb NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offline_sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"answered_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"display_name" varchar(40) NOT NULL,
	"avatar_emoji" varchar(16) DEFAULT '🧑‍🌾' NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"rank_tier" varchar(16) DEFAULT 'bronze' NOT NULL,
	"active_hero_id" integer,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"last_active_date" varchar(10),
	"streak_free_mode" boolean DEFAULT false NOT NULL,
	"streak_shield_used_month" varchar(7),
	"fifty_fifty_used_date" varchar(10),
	"bonus_ledger" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"onboarding_done" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_stats" (
	"question_id" integer PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"avg_ms" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"era_id" integer NOT NULL,
	"type" varchar(24) DEFAULT 'multiple_choice' NOT NULL,
	"difficulty" varchar(12) NOT NULL,
	"body" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"explanation" text NOT NULL,
	"source_ref" text NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"is_golden_standard" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quiz_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"question_ids" jsonb NOT NULL,
	"server_nonce" varchar(64) NOT NULL,
	"mode" varchar(16) DEFAULT 'daily' NOT NULL,
	CONSTRAINT "quiz_sessions_server_nonce_unique" UNIQUE("server_nonce")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "retention_probes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"week_offset" integer NOT NULL,
	"first_correct_at" timestamp with time zone NOT NULL,
	"probed_at" timestamp with time zone,
	"retained" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan" varchar(16) NOT NULL,
	"provider" varchar(16) NOT NULL,
	"external_invoice_id" varchar(128),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_artifacts" (
	"user_id" integer NOT NULL,
	"artifact_id" integer NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_heroes" (
	"user_id" integer NOT NULL,
	"hero_id" integer NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"level" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255),
	"provider" varchar(32) NOT NULL,
	"provider_id" varchar(128),
	"locale" varchar(8) DEFAULT 'mn' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attempts" ADD CONSTRAINT "attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_quiz_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "heroes" ADD CONSTRAINT "heroes_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_persona_hero_id_heroes_id_fk" FOREIGN KEY ("persona_hero_id") REFERENCES "public"."heroes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "league_members" ADD CONSTRAINT "league_members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "league_members" ADD CONSTRAINT "league_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mentor_cache" ADD CONSTRAINT "mentor_cache_persona_hero_id_heroes_id_fk" FOREIGN KEY ("persona_hero_id") REFERENCES "public"."heroes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offline_sync_log" ADD CONSTRAINT "offline_sync_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offline_sync_log" ADD CONSTRAINT "offline_sync_log_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_stats" ADD CONSTRAINT "question_stats_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions" ADD CONSTRAINT "questions_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retention_probes" ADD CONSTRAINT "retention_probes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "retention_probes" ADD CONSTRAINT "retention_probes_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_artifacts" ADD CONSTRAINT "user_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_artifacts" ADD CONSTRAINT "user_artifacts_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_heroes" ADD CONSTRAINT "user_heroes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_heroes" ADD CONSTRAINT "user_heroes_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."heroes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "attempts_session_question_uq" ON "attempts" USING btree ("session_id","question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attempts_user_created_idx" ON "attempts" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_persona_idx" ON "knowledge_chunks" USING btree ("persona_hero_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "league_members_uq" ON "league_members" USING btree ("league_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "leagues_week_tier_bucket_uq" ON "leagues" USING btree ("week_key","tier","bucket_no");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mentor_cache_uq" ON "mentor_cache" USING btree ("persona_hero_id","query_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offline_sync_uq" ON "offline_sync_log" USING btree ("user_id","question_id","answered_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_rank_xp_idx" ON "profiles" USING btree ("rank_tier","xp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_quiz_idx" ON "questions" USING btree ("era_id","difficulty","status") WHERE status = 'published';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quiz_sessions_user_idx" ON "quiz_sessions" USING btree ("user_id","issued_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "retention_probe_uq" ON "retention_probes" USING btree ("user_id","question_id","week_offset");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retention_due_idx" ON "retention_probes" USING btree ("user_id","week_offset","probed_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_artifacts_uq" ON "user_artifacts" USING btree ("user_id","artifact_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_heroes_uq" ON "user_heroes" USING btree ("user_id","hero_id");
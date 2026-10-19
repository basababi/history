CREATE TABLE "daily_answers" (
	"play_id" integer NOT NULL,
	"position" smallint NOT NULL,
	"question_id" integer NOT NULL,
	"served_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"selected_index" smallint,
	"is_correct" boolean,
	"response_ms" integer,
	CONSTRAINT "daily_answers_play_id_position_pk" PRIMARY KEY("play_id","position")
);
--> statement-breakpoint
CREATE TABLE "daily_plays" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"day_key" varchar(10) NOT NULL,
	"on_time" boolean DEFAULT false NOT NULL,
	"challenged_by_play_id" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"total_ms" integer DEFAULT 0 NOT NULL,
	"share_code" varchar(12),
	CONSTRAINT "daily_plays_share_code_unique" UNIQUE("share_code")
);
--> statement-breakpoint
CREATE TABLE "daily_sets" (
	"day_key" varchar(10) PRIMARY KEY NOT NULL,
	"question_ids" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friend_group_members" (
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "friend_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(8) NOT NULL,
	"name" varchar(40) NOT NULL,
	"owner_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rivalries" (
	"user_low" integer NOT NULL,
	"user_high" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rivalries_user_low_user_high_pk" PRIMARY KEY("user_low","user_high"),
	CONSTRAINT "rivalries_order_ck" CHECK ("rivalries"."user_low" < "rivalries"."user_high")
);
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "display_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "best_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "format" varchar(24) DEFAULT 'classic' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_answers" ADD CONSTRAINT "daily_answers_play_id_daily_plays_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."daily_plays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_answers" ADD CONSTRAINT "daily_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plays" ADD CONSTRAINT "daily_plays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plays" ADD CONSTRAINT "daily_plays_day_key_daily_sets_day_key_fk" FOREIGN KEY ("day_key") REFERENCES "public"."daily_sets"("day_key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_plays" ADD CONSTRAINT "daily_plays_challenged_by_play_id_daily_plays_id_fk" FOREIGN KEY ("challenged_by_play_id") REFERENCES "public"."daily_plays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_group_id_friend_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."friend_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_group_members" ADD CONSTRAINT "friend_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_groups" ADD CONSTRAINT "friend_groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rivalries" ADD CONSTRAINT "rivalries_user_low_users_id_fk" FOREIGN KEY ("user_low") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rivalries" ADD CONSTRAINT "rivalries_user_high_users_id_fk" FOREIGN KEY ("user_high") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_answers_question_idx" ON "daily_answers" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_plays_user_day_uq" ON "daily_plays" USING btree ("user_id","day_key");--> statement-breakpoint
CREATE INDEX "daily_plays_day_idx" ON "daily_plays" USING btree ("day_key","finished_at");--> statement-breakpoint
CREATE INDEX "daily_plays_user_finished_idx" ON "daily_plays" USING btree ("user_id","finished_at");--> statement-breakpoint
CREATE INDEX "friend_group_members_user_idx" ON "friend_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "friend_groups_owner_idx" ON "friend_groups" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "rivalries_high_idx" ON "rivalries" USING btree ("user_high");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_uq" ON "users" USING btree ("provider","provider_id");
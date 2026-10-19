CREATE TABLE "elder_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"contributor_id" integer NOT NULL,
	"kind" varchar(24) NOT NULL,
	"body" text NOT NULL,
	"elder_label" varchar(60) NOT NULL,
	"region_note" text,
	"consent_confirmed" boolean DEFAULT false NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewer_id" integer,
	"question_id" integer,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "elder_contributions" ADD CONSTRAINT "elder_contributions_contributor_id_users_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elder_contributions" ADD CONSTRAINT "elder_contributions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elder_contributions" ADD CONSTRAINT "elder_contributions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "elder_contrib_user_idx" ON "elder_contributions" USING btree ("contributor_id","created_at");--> statement-breakpoint
CREATE INDEX "elder_contrib_status_idx" ON "elder_contributions" USING btree ("status","created_at");
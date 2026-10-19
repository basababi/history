CREATE TABLE "mediation_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"kind" text DEFAULT 'explain_simple' NOT NULL,
	"user_text" text NOT NULL,
	"score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mediation_attempts" ADD CONSTRAINT "mediation_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mediation_attempts" ADD CONSTRAINT "mediation_attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mediation_attempts_uq" ON "mediation_attempts" USING btree ("user_id","question_id","kind");--> statement-breakpoint
CREATE INDEX "mediation_user_idx" ON "mediation_attempts" USING btree ("user_id","created_at");
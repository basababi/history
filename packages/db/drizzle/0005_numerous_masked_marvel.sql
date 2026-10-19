CREATE TABLE "classroom_members" (
	"classroom_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(8) NOT NULL,
	"name" varchar(60) NOT NULL,
	"owner_id" integer NOT NULL,
	"goal_target" integer DEFAULT 1000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "classrooms_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_members" ADD CONSTRAINT "classroom_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "classroom_members_uq" ON "classroom_members" USING btree ("classroom_id","user_id");--> statement-breakpoint
CREATE INDEX "classroom_members_user_idx" ON "classroom_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "classrooms_owner_idx" ON "classrooms" USING btree ("owner_id");